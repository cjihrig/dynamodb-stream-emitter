'use strict';
const Assert = require('assert');
const Lab = require('@hapi/lab');
const { DynamoDBStreamEmitter } = require('../lib');
const Fixtures = require('./fixtures');
const { MockClient } = require('./mock-client');
const { describe, it } = exports.lab = Lab.script();
const inactiveClient = new MockClient([]);


describe('DynamoDBStreamEmitter', () => {
  describe('constructor', () => {
    it('throws on bad inputs', () => {
      Assert.throws(() => {
        new DynamoDBStreamEmitter(null); // eslint-disable-line no-new
      }, /^TypeError: options must be an object$/);

      Assert.throws(() => {
        new DynamoDBStreamEmitter(5); // eslint-disable-line no-new
      }, /^TypeError: options must be an object$/);

      Assert.throws(() => {
        // eslint-disable-next-line no-new
        new DynamoDBStreamEmitter({ client: null });
      }, /^TypeError: client must be an object$/);

      Assert.throws(() => {
        // eslint-disable-next-line no-new
        new DynamoDBStreamEmitter({ client: inactiveClient, sleepMs: 'abc' });
      }, /^TypeError: sleepMs must be a number$/);

      Assert.throws(() => {
        // eslint-disable-next-line no-new
        new DynamoDBStreamEmitter({ client: inactiveClient, sleepMs: 3.14 });
      }, /^RangeError: sleepMs must be a 32-bit signed integer$/);

      Assert.throws(() => {
        // eslint-disable-next-line no-new
        new DynamoDBStreamEmitter({ client: inactiveClient, sleepMs: -1 });
      }, /^RangeError: sleepMs must be between 1 and 2147483647$/);

      Assert.throws(() => {
        // eslint-disable-next-line no-new
        new DynamoDBStreamEmitter({
          client: inactiveClient,
          getRecordsLimit: 1001
        });
      }, /^RangeError: getRecordsLimit must be between 1 and 1000$/);

      Assert.throws(() => {
        // eslint-disable-next-line no-new
        new DynamoDBStreamEmitter({
          client: inactiveClient,
          tableName: false
        });
      }, /^TypeError: tableName must be a string$/);
    });
  });

  describe('start(), stop(), and isPolling()', () => {
    it('running state is initially false', () => {
      const ee = new DynamoDBStreamEmitter({ client: inactiveClient });

      Assert.strictEqual(ee.isPolling(), false);
    });

    it('start() and stop() toggle the running state', () => {
      const ee = new DynamoDBStreamEmitter({ client: inactiveClient });

      Assert.strictEqual(ee.isPolling(), false);
      ee.start();
      Assert.strictEqual(ee.isPolling(), true);
      ee.stop();
      Assert.strictEqual(ee.isPolling(), false);
    });

    it('start() throws if already running', () => {
      const ee = new DynamoDBStreamEmitter({ client: inactiveClient });

      ee.start();
      Assert.throws(() => {
        ee.start();
      }, /^Error: already started$/);
    });

    it('start() emits the "start" event', () => {
      return new Promise((resolve) => {
        const client = new MockClient([
          Fixtures.simpleListResult
        ]);
        const ee = new DynamoDBStreamEmitter({ client });

        ee.on('start', (arg) => {
          Assert.strictEqual(arg, undefined);
          resolve();
        });

        ee.start();
      });
    });

    it('stop() emits the "stop" event', () => {
      return new Promise((resolve) => {
        const client = new MockClient([
          Fixtures.simpleListResult
        ]);
        const ee = new DynamoDBStreamEmitter({ client });

        ee.on('stop', (state) => {
          Assert.strictEqual(state instanceof Map, true);
          resolve();
        });

        ee.start();
        ee.stop();
      });
    });

    it('stop() can be called multiple times', () => {
      return new Promise((resolve) => {
        const client = new MockClient([
          Fixtures.simpleListResult
        ]);
        const ee = new DynamoDBStreamEmitter({ client });
        let stopEmitted = false;

        ee.on('stop', (state) => {
          Assert.strictEqual(stopEmitted, false);
          stopEmitted = true;
          resolve();
        });

        ee.start();
        ee.stop();
        ee.stop();
      });
    });

    it('start() validates the optional initial state', () => {
      const ee = new DynamoDBStreamEmitter({ client: inactiveClient });

      Assert.throws(() => {
        ee.start(null);
      }, /^TypeError: initialGlobalState must be an Array or Map$/);

      Assert.throws(() => {
        ee.start(new Map([[5]]));
      }, /^TypeError: shard identifier 5 must be a string$/);

      Assert.throws(() => {
        ee.start(new Map([['shard-id']]));
      }, /^TypeError: shard shard-id state must be an object$/);

      Assert.throws(() => {
        ee.start(new Map([['shard-id', { streamArn: null }]]));
      }, /^TypeError: shard shard-id streamArn must be a string$/);

      Assert.throws(() => {
        ee.start(new Map([
          ['shard-id', { streamArn: 'stream-arn', iteratorType: 5 }]
        ]));
      }, /^TypeError: shard shard-id iteratorType must be a string$/);

      Assert.throws(() => {
        ee.start(new Map([
          ['shard-id', {
            streamArn: 'stream-arn',
            iteratorType: 'iterator-type',
            shardId: 5
          }]
        ]));
      }, /^Error: shard shard-id has mismatched shardId: 5$/);

      Assert.throws(() => {
        ee.start(new Map([
          ['shard-id', {
            streamArn: 'stream-arn',
            iteratorType: 'iterator-type',
            shardId: 'shard-id',
            lastSequenceNumber: null
          }]
        ]));
      }, /^TypeError: shard shard-id lastSequenceNumber must be a string$/);
    });

    it('start() accepts an array representation of a Map', () => {
      const ee = new DynamoDBStreamEmitter({ client: inactiveClient });
      const initialState = [
        ['shard-id', {
          streamArn: 'stream-arn',
          iteratorType: 'iterator-type',
          shardId: 'shard-id'
        }],
        ['shard-id-2', {
          streamArn: 'stream-arn',
          iteratorType: 'iterator-type',
          shardId: 'shard-id-2'
        }]
      ];

      ee.start(initialState);
    });

    it('the "stop" event waits for the "start" event', () => {
      return new Promise((resolve) => {
        const client = new MockClient([
          Fixtures.simpleListResult
        ]);
        const ee = new DynamoDBStreamEmitter({ client });
        const initialState = new Map([
          ['shard-id', {
            streamArn: 'stream-arn',
            iteratorType: 'iterator-type',
            shardId: 'shard-id',
            lastSequenceNumber: '000000000000000000001'
          }]
        ]);
        let startEmitted = false;

        ee.on('start', () => {
          startEmitted = true;
        });

        ee.on('stop', (state) => {
          Assert.strictEqual(startEmitted, true);
          Assert.deepStrictEqual(state, initialState);
          resolve();
        });

        ee.start(initialState);
        ee.stop();
      });
    });
  });

  describe('listStreams()', () => {
    it('listStreams() is called in a loop', () => {
      return new Promise((resolve) => {
        const client = new MockClient([
          Fixtures.paginatedListResult1,
          Fixtures.simpleDescribeResult,
          Fixtures.paginatedListResult2
        ]);
        const ee = new DynamoDBStreamEmitter({ client });

        ee.start();
        setImmediate(() => {
          const listCalls = client._getCallsByName('listStreams');

          Assert.strictEqual(listCalls.length, 2);
          Assert.strictEqual(listCalls[1].options.ExclusiveStartStreamArn,
            Fixtures.paginatedListResult1.LastEvaluatedStreamArn);
          resolve();
        });
      });
    });

    it('can return results for a single table', () => {
      return new Promise((resolve) => {
        const client = new MockClient([
          Fixtures.simpleListResult
        ]);
        const ee = new DynamoDBStreamEmitter({
          client,
          tableName: 'table-name'
        });

        ee.start();
        setImmediate(() => {
          const listCalls = client._getCallsByName('listStreams');

          Assert.strictEqual(listCalls.length, 1);
          Assert.strictEqual(listCalls[0].options.TableName, 'table-name');
          resolve();
        });
      });
    });

    it('tolerates errors returned from the AWS SDK', () => {
      return new Promise((resolve) => {
        const client = new MockClient([
          new Error('uh oh')
        ]);
        const ee = new DynamoDBStreamEmitter({ client });

        ee.start();
        setImmediate(() => {
          Assert.strictEqual(client.calls.length, 1);
          Assert.strictEqual(client.calls[0].call, 'listStreams');
          Assert.deepStrictEqual(client.results, []);
          resolve();
        });
      });
    });
  });

  describe('describeStream()', () => {
    it('describeStream() is called in a loop', () => {
      return new Promise((resolve) => {
        const client = new MockClient([
          Fixtures.simpleListResult,
          Fixtures.paginatedDescribeResult1,
          Fixtures.paginatedDescribeResult2
        ]);
        const ee = new DynamoDBStreamEmitter({ client });

        ee.start();
        setImmediate(() => {
          const describeCalls = client._getCallsByName('describeStream');

          Assert.strictEqual(describeCalls.length, 2);
          Assert.strictEqual(describeCalls[1].options.ExclusiveStartShardId,
            Fixtures.paginatedDescribeResult1.StreamDescription.LastEvaluatedShardId);
          resolve();
        });
      });
    });

    it('tolerates errors returned from the AWS SDK', () => {
      return new Promise((resolve) => {
        const client = new MockClient([
          Fixtures.simpleListResult,
          new Error('uh oh')
        ]);
        const ee = new DynamoDBStreamEmitter({ client });

        ee.start();
        setImmediate(() => {
          Assert.strictEqual(client.calls.length, 2);
          Assert.strictEqual(client.calls[0].call, 'listStreams');
          Assert.strictEqual(client.calls[1].call, 'describeStream');
          Assert.deepStrictEqual(client.results, []);
          resolve();
        });
      });
    });
  });

  describe('getShardIterator()', () => {
    it('tolerates errors returned from the AWS SDK', () => {
      return new Promise((resolve) => {
        const client = new MockClient([
          Fixtures.simpleListResult,
          Fixtures.simpleDescribeResult,
          new Error('uh oh')
        ]);
        const ee = new DynamoDBStreamEmitter({ client });

        ee.start();
        setImmediate(() => {
          Assert.strictEqual(client.calls.length, 3);
          Assert.strictEqual(client.calls[0].call, 'listStreams');
          Assert.strictEqual(client.calls[1].call, 'describeStream');
          Assert.strictEqual(client.calls[2].call, 'getShardIterator');
          Assert.deepStrictEqual(client.results, []);
          resolve();
        });
      });
    });
  });

  describe('getRecords()', () => {
    it('tolerates errors returned from the AWS SDK', () => {
      return new Promise((resolve) => {
        const client = new MockClient([
          Fixtures.simpleListResult,
          Fixtures.simpleDescribeResult,
          Fixtures.simpleShardIteratorResult,
          new Error('uh oh')
        ]);
        const ee = new DynamoDBStreamEmitter({ client });

        ee.start();
        setImmediate(() => {
          Assert.strictEqual(client.calls.length, 4);
          Assert.strictEqual(client.calls[0].call, 'listStreams');
          Assert.strictEqual(client.calls[1].call, 'describeStream');
          Assert.strictEqual(client.calls[2].call, 'getShardIterator');
          Assert.strictEqual(client.calls[3].call, 'getRecords');
          Assert.deepStrictEqual(client.results, []);
          resolve();
        });
      });
    });
  });

  describe('record event', () => {
    it('emits records that are received from DDB', () => {
      return new Promise((resolve) => {
        const client = new MockClient([
          Fixtures.simpleListResult,
          Fixtures.multishardPaginatedDescribeResult1,
          Fixtures.simpleShardIteratorResult,
          Fixtures.simpleShardIteratorResult,
          Fixtures.multishardPaginatedDescribeResult2,
          Fixtures.simpleShardIteratorResult,
          Fixtures.simpleShardIteratorResult,
          Fixtures.simpleRecordResult,
          Fixtures.simpleRecordResult2,
          Fixtures.simpleRecordResult3,
          Fixtures.simpleRecordResult4,
          Fixtures.multishardPaginatedDisabledDescribeResult
        ]);
        const ee = new DynamoDBStreamEmitter({ client, sleepMs: 1 });
        let recordCnt = 0;

        ee.on('record', (record, streamArn, shardId) => {
          recordCnt++;

          switch (recordCnt) {
            case 1 :
              Assert.deepStrictEqual(record,
                Fixtures.simpleRecordResult.Records[0]);
              Assert.strictEqual(streamArn,
                Fixtures.multishardPaginatedDescribeResult1.StreamDescription.StreamArn);
              Assert.strictEqual(shardId,
                Fixtures.multishardPaginatedDescribeResult1.StreamDescription.Shards[0].ShardId);
              break;
            case 2 :
              Assert.deepStrictEqual(record,
                Fixtures.simpleRecordResult2.Records[0]);
              Assert.strictEqual(streamArn,
                Fixtures.multishardPaginatedDescribeResult1.StreamDescription.StreamArn);
              Assert.strictEqual(shardId,
                Fixtures.multishardPaginatedDescribeResult1.StreamDescription.Shards[1].ShardId);
              break;
            case 3 :
              Assert.deepStrictEqual(record,
                Fixtures.simpleRecordResult3.Records[0]);
              Assert.strictEqual(streamArn,
                Fixtures.multishardPaginatedDescribeResult2.StreamDescription.StreamArn);
              Assert.strictEqual(shardId,
                Fixtures.multishardPaginatedDescribeResult2.StreamDescription.Shards[0].ShardId);
              break;
            case 4 :
              Assert.deepStrictEqual(record,
                Fixtures.simpleRecordResult4.Records[0]);
              Assert.strictEqual(streamArn,
                Fixtures.multishardPaginatedDescribeResult2.StreamDescription.StreamArn);
              Assert.strictEqual(shardId,
                Fixtures.multishardPaginatedDescribeResult2.StreamDescription.Shards[1].ShardId);

              // Give time for the sleep calls to run.
              setTimeout(() => {
                resolve();
              }, 1000);
              break;
            default :
              Assert.fail('Unexpected record');
          }
        });

        ee.start();
      });
    });
  });
});
