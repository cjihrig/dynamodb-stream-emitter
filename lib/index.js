'use strict';
const { EventEmitter } = require('events');
const { debuglog } = require('util');
const kDescribeStreamMaxLimit = 100;
const kGetRecordsMaxLimit = 1000;
const kListStreamsMaxLimit = 100;
const kTimeoutMax = 2 ** 31 - 1;
const kClient = Symbol('client');
const kConsumeAllStreams = Symbol('consumeAllStreams');
const kConsumeShard = Symbol('consumeShard');
const kConsumeStream = Symbol('consumeStream');
const kDescribeStream = Symbol('describeStream');
const kDescribeStreamLimit = Symbol('describeStreamLimit');
const kGetRecords = Symbol('getRecords');
const kGetRecordsLimit = Symbol('getRecordsLimit');
const kGetShardIterator = Symbol('getShardIterator');
const kListStreams = Symbol('listStreams');
const kListStreamsLimit = Symbol('listStreamsLimit');
const kRunning = Symbol('running');
const kSleepMs = Symbol('sleepMs');
const kStartEmitted = Symbol('startEmitted');
const kStreamPromises = Symbol('streamPromises');
const kTableName = Symbol('tableName');
const debug = debuglog('dynamodbstreamemitter');


class DynamoDBStreamEmitter extends EventEmitter {
  constructor (options = {}) {
    super();

    validateObject(options, 'options');

    const {
      client,
      describeStreamLimit = kDescribeStreamMaxLimit,
      getRecordsLimit = kGetRecordsMaxLimit,
      listStreamsLimit = kListStreamsMaxLimit,
      sleepMs = 1000,
      tableName
    } = options;

    validateObject(client, 'client');
    validateInt32(sleepMs, 'sleepMs', 1, kTimeoutMax);
    validateInt32(
      listStreamsLimit,
      'listStreamsLimit',
      1,
      kListStreamsMaxLimit
    );
    validateInt32(
      describeStreamLimit,
      'describeStreamLimit',
      1,
      kDescribeStreamMaxLimit
    );
    validateInt32(getRecordsLimit, 'getRecordsLimit', 1, kGetRecordsMaxLimit);

    if (tableName !== undefined) {
      validateString(tableName, 'tableName');
    }

    this[kClient] = client;
    this[kDescribeStreamLimit] = describeStreamLimit;
    this[kGetRecordsLimit] = getRecordsLimit;
    this[kListStreamsLimit] = listStreamsLimit;
    this[kRunning] = false;
    this[kSleepMs] = sleepMs;
    this[kStartEmitted] = false;
    this[kStreamPromises] = [];
    this[kTableName] = tableName;
  }

  start (initialGlobalState) {
    debug('emitter started');

    if (this[kRunning] === true) {
      throw new Error('already started');
    }

    const perStreamInitialState = createAndValidatePerStreamInitialState(
      initialGlobalState,
      'initialGlobalState'
    );

    this[kRunning] = true;
    this[kStartEmitted] = false;
    this[kConsumeAllStreams](perStreamInitialState).then(() => {
      this[kStartEmitted] = true;
      this.emit('start');
    });
  }

  stop () {
    debug('emitter stopped');

    if (!this[kRunning]) {
      return;
    }

    this[kRunning] = false;
    emitStopEvent(this);
  }

  isPolling () {
    return this[kRunning];
  }

  async [kConsumeAllStreams] (perStreamInitialState) {
    // This function should only run via start() to gather the list of
    // streams to poll. To start listening on new/additional streams, restart
    // the emitter or create another emitter.
    let startStreamArn;

    // The do...while loop is necessary in case all of the streams cannot be
    // returned in a single listStreams() call.
    this[kStreamPromises] = [];

    do {
      const {
        LastEvaluatedStreamArn,
        Streams
      } = await this[kListStreams](startStreamArn, this[kTableName]);

      for (const { StreamArn } of Streams) {
        const initialState = perStreamInitialState.get(StreamArn) || new Map();
        const promise = this[kConsumeStream](StreamArn, initialState);

        this[kStreamPromises].push(promise);
      }

      startStreamArn = LastEvaluatedStreamArn;
    } while (startStreamArn);
  }

  async [kConsumeStream] (streamArn, initialState) {
    let previouslySeen = initialState;
    let seen = new Map();
    let iteratorType = 'LATEST';
    let streamIsEnabled = true;

    // The while loop is necessary to poll the stream. Without this loop, any
    // new shards that are created after the first calls to describeStream()
    // will be missed.
    //
    // On the first time through the loop, create 'LATEST' shard iterators to
    // avoid getting records from before we started listening for events. On
    // subsequent loop iterations 'TRIM_HORIZON' shard iterators can be used
    // to get all records for new shards. For shards that are visited multiple
    // times, use 'AFTER_SEQUENCE_NUMBER' shard iterators to avoid duplicating
    // records.
    //
    // We avoid reprocessing shards by tracking the shards seen on the current
    // and previous loop iteration. At the end of each loop iteration, the
    // current set of shards becomes the previous set of shards. This prevents
    // potential memory leaks that could arise from not cleaning up a Set
    // properly as old shards are removed from the stream.
    while (this[kRunning] && streamIsEnabled) {
      const shardsToProcess = new Set();
      let startShardId;

      debug(
        'stream \'%s\': polling, iteratorType =',
        streamArn,
        iteratorType
      );

      // The do...while loop is necessary in case all of the shards cannot be
      // returned in a single describeStream() call.
      do {
        const {
          LastEvaluatedShardId,
          Shards,
          StreamStatus
        } = await this[kDescribeStream](streamArn, startShardId);

        // If the stream has been disabled, there won't be any new records.
        // If streaming is re-enabled, a new stream will be created with a
        // different descriptor.
        if (StreamStatus === 'DISABLED') {
          debug('stream \'%s\': now disabled', streamArn);
          streamIsEnabled = false;
        }

        // Create iterators for all shards before beginning to consume any data.
        // This reduces the chance of missing any records in later shards while
        // processing the earlier shards.
        for (const { ShardId, SequenceNumberRange } of Shards) {
          const previousShardState = previouslySeen.get(ShardId);
          const shardState = previousShardState || {
            streamArn,
            shardId: ShardId,
            iteratorType,
            iterator: undefined,
            lastSequenceNumber: undefined
          };

          seen.set(ShardId, shardState);
          // TODO(cjihrig): It should be safe to delete the shard from the
          // previouslySeen map at this point.

          if (previousShardState && shardState.lastSequenceNumber) {
            // This is an existing shard that has already been visited, and has
            // generated at least one record.
            //
            // If the shard has an ending sequence number, then it is closed and
            // will not generate new records. If the ending sequence number also
            // matches the last processed sequence number, then it has been
            // completely processed and can be skipped.
            if (shardState.lastSequenceNumber ===
                SequenceNumberRange.EndingSequenceNumber) {
              debug(
                'stream \'%s\': skipping exhausted closed shard \'%s\'',
                streamArn,
                ShardId
              );
              continue;
            }

            // Create an iterator that continues processing where we left off.
            shardState.iteratorType = 'AFTER_SEQUENCE_NUMBER';
            debug(
              'stream \'%s\': reprocessing open shard \'%s\' from \'%s\'',
              streamArn,
              ShardId,
              shardState.lastSequenceNumber
            );
          }

          debug(
            'stream \'%s\': creating iterator for \'%s\'',
            streamArn,
            ShardId
          );
          shardState.iterator = await this[kGetShardIterator](
            streamArn,
            ShardId,
            shardState.iteratorType,
            shardState.lastSequenceNumber
          );
          shardsToProcess.add(shardState);
        }

        startShardId = LastEvaluatedShardId;
      } while (startShardId);

      // Process the shards in order.
      for (const shardState of shardsToProcess) {
        const lastSequenceNumber = await this[kConsumeShard](
          streamArn,
          shardState.shardId,
          shardState.iterator
        );

        if (lastSequenceNumber) {
          shardState.lastSequenceNumber = lastSequenceNumber;
        }
      }

      // Don't change state if nothing happened on this iteration.
      if (seen.size > 0) {
        iteratorType = 'TRIM_HORIZON';
        previouslySeen = seen;
        seen = new Map();
      }

      await sleep(this[kSleepMs]);
    }

    return previouslySeen;
  }

  // eslint-disable-next-line require-await
  async [kConsumeShard] (streamArn, shardId, iterator) {
    // eslint-disable-next-line no-async-promise-executor
    return new Promise(async (resolve) => {
      let lastSequenceNumber;

      debug(
        'stream \'%s\': starting consumption of shard \'%s\'',
        streamArn,
        shardId
      );

      // It is possible for the Records array returned by getRecords() to be
      // empty, and the shard still create more data in a subsequent query. The
      // shard has not been consumed until getRecords() returns null in the
      // NextShardIterator field.
      while (iterator && this[kRunning]) {
        const {
          NextShardIterator,
          Records
        } = await this[kGetRecords](iterator);

        if (Records.length > 0 && this[kRunning]) {
          debug(
            'stream \'%s\': shard \'%s\' produced %d record(s)',
            streamArn,
            shardId,
            Records.length
          );

          for (const record of Records) {
            this.emit('record', record, streamArn, shardId);
          }

          const lastRecord = Records[Records.length - 1];
          lastSequenceNumber = lastRecord.dynamodb.SequenceNumber;
        }

        // eslint-disable-next-line require-atomic-updates
        iterator = NextShardIterator;
        await sleep(this[kSleepMs]);
      }

      debug(
        'stream \'%s\': finished consumption of shard \'%s\', last record = %s',
        streamArn,
        shardId,
        lastSequenceNumber
      );

      resolve(lastSequenceNumber);
    });
  }

  async [kListStreams] (startStreamArn, tableName) {
    try {
      return await this[kClient].listStreams({
        TableName: tableName,
        ExclusiveStartStreamArn: startStreamArn,
        Limit: this[kListStreamsLimit]
      }).promise();
    } catch (err) {
      debug('error: listStreams, \'%s\', %o', startStreamArn, err);

      return {
        LastEvaluatedStreamArn: '',
        Streams: []
      };
    }
  }

  async [kDescribeStream] (streamArn, startShardId) {
    try {
      return (await this[kClient].describeStream({
        StreamArn: streamArn,
        ExclusiveStartShardId: startShardId,
        Limit: this[kDescribeStreamLimit]
      }).promise()).StreamDescription;
    } catch (err) {
      debug(
        'error: describeStream, \'%s\', \'%s\', %o',
        streamArn,
        startShardId,
        err
      );

      return {
        LastEvaluatedShardId: '',
        Shards: []
      };
    }
  }

  async [kGetShardIterator] (streamArn, shardId, iteratorType, sequenceNumber) {
    try {
      const { ShardIterator } = await this[kClient].getShardIterator({
        StreamArn: streamArn,
        ShardId: shardId,
        ShardIteratorType: iteratorType,
        SequenceNumber: sequenceNumber
      }).promise();

      return ShardIterator;
    } catch (err) {
      debug(
        'error: getShardIterator, \'%s\', \'%s\', \'%s\', \'%s\', %o',
        streamArn,
        shardId,
        iteratorType,
        sequenceNumber,
        err
      );

      return '';
    }
  }

  async [kGetRecords] (iterator) {
    try {
      return await this[kClient].getRecords({
        ShardIterator: iterator,
        Limit: this[kGetRecordsLimit]
      }).promise();
    } catch (err) {
      debug('error: getRecords, \'%s\' %o', iterator, err);

      return {
        NextShardIterator: null,
        Records: []
      };
    }
  }
}


async function sleep (delay) {  // eslint-disable-line require-await
  return new Promise((resolve) => {
    setTimeout(resolve, delay);
  });
}


function validateObject (input, name) {
  if (input === null || typeof input !== 'object') {
    throw new TypeError(`${name} must be an object`);
  }
}


function validateString (input, name) {
  if (typeof input !== 'string') {
    throw new TypeError(`${name} must be a string`);
  }
}


function validateInt32 (value, name, min = -2147483648, max = 2147483647) {
  if (typeof value !== 'number') {
    throw new TypeError(`${name} must be a number`);
  }

  if (value !== (value | 0)) {
    throw new RangeError(`${name} must be a 32-bit signed integer`);
  }

  if (value < min || value > max) {
    throw new RangeError(`${name} must be between ${min} and ${max}`);
  }
}


function createAndValidatePerStreamInitialState (initialValue, name) {
  // This function takes an Array or Map representation of the global state
  // (all shards across all streams), and returns Maps of the shard state for
  // each individual stream.

  if (initialValue === undefined) {
    return new Map();
  }

  let globalState;

  if (Array.isArray(initialValue)) {
    globalState = new Map(initialValue);
  } else if (initialValue instanceof Map) {
    globalState = initialValue;
  } else {
    throw new TypeError(`${name} must be an Array or Map`);
  }

  const perStreamState = new Map();

  for (const [shardId, shardState] of globalState) {
    validateString(shardId, `shard identifier ${shardId}`);
    validateObject(shardState, `shard ${shardId} state`);

    const { streamArn, iteratorType, lastSequenceNumber } = shardState;

    validateString(streamArn, `shard ${shardId} streamArn`);
    validateString(iteratorType, `shard ${shardId} iteratorType`);

    // No need to validate shardState.iterator as it always gets overwritten.

    if (shardId !== shardState.shardId) {
      throw new Error(
        `shard ${shardId} has mismatched shardId: ${shardState.shardId}`
      );
    }

    if (lastSequenceNumber !== undefined) {
      validateString(lastSequenceNumber, `shard ${shardId} lastSequenceNumber`);
    }

    let streamState = perStreamState.get(streamArn);

    if (streamState === undefined) {
      streamState = new Map();
      perStreamState.set(streamArn, streamState);
    }

    streamState.set(shardId, shardState);
  }

  return perStreamState;
}


function emitStopEvent (emitter) {
  // If the 'start' event hasn't been emitted yet, then wait for it before
  // emitting the 'stop' event.
  if (!emitter[kStartEmitted]) {
    emitter.once('start', () => {
      emitStopEvent(emitter);
    });
    return;
  }

  Promise.all(emitter[kStreamPromises]).then((streamStates) => {
    const globalState = new Map();

    for (const streamState of streamStates) {
      streamState.forEach((shardState, shardId) => {
        globalState.set(shardId, shardState);
      });
    }

    emitter.emit('stop', globalState);
  });
}


module.exports = { DynamoDBStreamEmitter };
