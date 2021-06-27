# dynamodb-stream-emitter

[![Current Version](https://img.shields.io/npm/v/dynamodb-stream-emitter.svg)](https://www.npmjs.org/package/dynamodb-stream-emitter)
[![Build Status via Travis CI](https://travis-ci.org/cjihrig/dynamodb-stream-emitter.svg?branch=master)](https://travis-ci.org/cjihrig/dynamodb-stream-emitter)
![Dependencies](http://img.shields.io/david/cjihrig/dynamodb-stream-emitter.svg)
[![belly-button-style](https://img.shields.io/badge/eslint-bellybutton-4B32C3.svg)](https://github.com/cjihrig/belly-button)

[`EventEmitter`](https://nodejs.org/api/events.html) adapter for [DynamoDB streams](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Streams.html).

## Usage

`dynamodb-stream-emitter` exports a single class, `DynamoDBStreamEmitter` that extends the Node.js
`EventEmitter`. The following example demonstrates its usage.

```javascript
'use strict';
const { DynamoDBStreamEmitter } = require('dynamodb-stream-emitter');
const { DynamoDBStreams } = require('aws-sdk');
const client = new DynamoDBStreams();
const ee = new DynamoDBStreamEmitter({ client });

ee.on('record', (record, streamArn, shardId) => {
  console.log(record, streamArn, shardId);
});

ee.start();
```

## API

The `DynamoDBStreamEmitter` class is an abstraction around the AWS SDK's `DynamoDBStreams` client.

### `DynamoDBStreamEmitter(options)` Constructor

  - Arguments
    - `options` (object) - Configuration data supporting the following options:
      - `client` (object) - An AWS SDK `DynamoDBStreams` client.
      - `describeStreamLimit` (integer) - The maximum number of streams to return from each call to [DescribeStream()](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_streams_DescribeStream.html). Optional. Defaults to 100 (the maximum value supported by AWS).
      - `getRecordsLimit` (integer) - The maximum number of streams to return from each call to [GetRecords()](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_streams_GetRecords.html). Optional. Defaults to 1,000 (the maximum value supported by AWS).
      - `listStreamsLimit` (integer) - The maximum number of streams to return from each call to [ListStreams()](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_streams_ListStreams.html). Optional. Defaults to 100 (the maximum value supported by AWS).
      - `sleepMs` (integer) - The amount of time, in milliseconds, to wait between polling API calls. Optional. Defaults to 1,000 milliseconds.
      - `tableName` (string) - The name of the DynamoDB table to return streams for. Optional. Defaults to all available streams.

Constructs a new `DynamoDBStreamEmitter` instance.

### `DynamoDBStreamEmitter.prototype.start(initialState)`

  - Arguments
    - `state` (Map or array representation of a Map) - A map of shard IDs (string) to shard states (object) to poll on. Only shards belonging to streams that the emitter is polling are processed. The schema of each shard state is:
      - `streamArn` (string) - The stream ARN of the shard.
      - `shardId` (string) - The shard identifier.
      - `iteratorType` (string) - The type of DynamoDB shard iterator to create. If `lastSequenceNumber` is present, this field will be set to `'AFTER_SEQUENCE_NUMBER'`.
      - `lastSequenceNumber` (string) - The sequence number in the shard to resume reading after. Optional.
  - Returns
    - Nothing

This function begins polling for DynamoDB stream events. If `start()` is called on an emitter that is already polling, an exception is thrown.

### `DynamoDBStreamEmitter.prototype.stop()`

  - Arguments
    - None
  - Returns
    - Nothing

This function stops polling for DynamoDB stream events. Unlike `start()`, the `stop()` function is idempotent.

### `DynamoDBStreamEmitter.prototype.isPolling()`

  - Arguments
    - None
  - Returns
    - A boolean indicating whether the emitter is polling or not.

This function returns a boolean indicating whether the emitter is polling or not.

### `'record'` Event

  - Arguments
    - `record` (object) - A [`Record`](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_streams_Record.html) object.
    - `streamArn` (string) - The stream ARN that produced `record`.
    - `shardId` (string) - The shard identifier that produced `record`.

This event is emitted each time a new record is read from the stream.

### `'start'` Event

  - Arguments
    - None

This event is emitted once `DynamoDBStreamEmitter.prototype.start()` has been called and stream polling has begun.

### `'stop'` Event

  - Arguments
    - `state` (Map) - The current state of all DynamoDB streams being polled by the emitter.

This event is emitted once `DynamoDBStreamEmitter.prototype.stop()` has been called and any existing DynamoDB polling streams are shutdown. The current state of all existing streams is also provided as an argument to the event handler.

The state is represented as a JavaScript [Map](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map). The state `Map` can be passed to `DynamoDBStreamEmitter.prototype.start()` in order to resume listening. The state `Map` can be serialized to JSON using `JSON.stringify(Array.from(state))` and deserialized back to a `Map` using `new Map(JSON.parse(jsonString))`.
