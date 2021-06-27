/// <reference types="node" />
import { EventEmitter } from 'events';


// These come from the AWS SDK.
export declare type DynamoDBStreamEmitterRecord = unknown;
export declare type DynamoDBStreamEmitterClient = unknown;


export declare type DynamoDBStreamEmitterOptions = {
  client: DynamoDBStreamEmitterClient;
  describeStreamLimit?: number;
  getRecordsLimit?: number;
  listStreamsLimit?: number;
  sleepMs?: number;
  tableName?: string;
};


export declare type DynamoDBStreamEmitterShardState = {
  streamArn: string;
  shardId: string;
  iteratorType: 'LATEST' | 'TRIM_HORIZON' | 'AFTER_SEQUENCE_NUMBER';
  iterator?: string;
  lastSequenceNumber?: string;
};


export declare type DynamoDBStreamEmitterState =
  Map<string, DynamoDBStreamEmitterShardState>;
export declare type DynamoDBStreamEmitterStateArray =
  Array<Array<string | DynamoDBStreamEmitterShardState>>;
export declare type DynamoDBStreamEmitterInitialState =
  DynamoDBStreamEmitterState | DynamoDBStreamEmitterStateArray;


export declare interface DynamoDBStreamEmitter {
  on(event: 'start', listener: (name: string) => void): this;
  on(
    event: 'stop',
    listener: (name: string, state: DynamoDBStreamEmitterState) => void
  ): this;
  on(
    event: 'record',
    listener: (
      name: string,
      record: DynamoDBStreamEmitterRecord,
      streamArn: string,
      shardId: string
    ) => void
  ): this;
  on(event: string, listener: Function): this;
}


export declare class DynamoDBStreamEmitter extends EventEmitter {
  constructor(options: DynamoDBStreamEmitterOptions);
  start(initialGlobalState?: DynamoDBStreamEmitterInitialState): void;
  stop(): void;
  isPolling(): boolean;
}
