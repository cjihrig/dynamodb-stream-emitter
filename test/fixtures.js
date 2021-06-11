'use strict';
module.exports = {
  simpleListResult: {
    LastEvaluatedStreamArn: '',
    Streams: [
      {
        StreamArn: 'stream-arn',
        StreamLabel: 'stream-label',
        TableName: 'table-name'
      }
    ]
  },
  simpleDescribeResult: {
    StreamDescription: {
      LastEvaluatedShardId: '',
      Shards: [
        {
          SequenceNumberRange: {
            StartingSequenceNumber: '000000000000000000001',
            EndingSequenceNumber: '000000000000000000001'
          },
          ShardId: 'shard-id'
        }
      ],
      StreamArn: 'stream-arn',
      StreamLabel: 'stream-label',
      StreamStatus: 'ENABLED',
      StreamViewType: 'NEW_AND_OLD_IMAGES',
      TableName: 'table-name'
    }
  },
  simpleShardIteratorResult: { ShardIterator: 'shard-id-iterator' },
  simpleRecordResult: {
    NextShardIterator: null,
    Records: [
      {
        awsRegion: 'us-east-1',
        dynamodb: { SequenceNumber: '000000000000000000001' },
        eventID: 'event-id',
        eventName: 'INSERT',
        eventVersion: '1.1',
        eventSource: 'aws:dynamodb'
      }
    ]
  },
  simpleRecordResult2: {
    NextShardIterator: null,
    Records: [
      {
        awsRegion: 'us-east-1',
        dynamodb: { SequenceNumber: '000000000000000000003' },
        eventID: 'event-id',
        eventName: 'INSERT',
        eventVersion: '1.1',
        eventSource: 'aws:dynamodb'
      }
    ]
  },
  simpleRecordResult3: {
    NextShardIterator: null,
    Records: [
      {
        awsRegion: 'us-east-1',
        dynamodb: { SequenceNumber: '000000000000000000004' },
        eventID: 'event-id',
        eventName: 'INSERT',
        eventVersion: '1.1',
        eventSource: 'aws:dynamodb'
      }
    ]
  },
  simpleRecordResult4: {
    NextShardIterator: null,
    Records: [
      {
        awsRegion: 'us-east-1',
        dynamodb: { SequenceNumber: '000000000000000000005' },
        eventID: 'event-id',
        eventName: 'INSERT',
        eventVersion: '1.1',
        eventSource: 'aws:dynamodb'
      }
    ]
  },
  paginatedListResult1: {
    LastEvaluatedStreamArn: 'stream-arn',
    Streams: [
      {
        StreamArn: 'stream-arn',
        StreamLabel: 'stream-label',
        TableName: 'table-name'
      }
    ]
  },
  paginatedListResult2: {
    LastEvaluatedStreamArn: '',
    Streams: [
      {
        StreamArn: 'stream-arn-2',
        StreamLabel: 'stream-label-2',
        TableName: 'table-name-2'
      }
    ]
  },
  paginatedDescribeResult1: {
    StreamDescription: {
      LastEvaluatedShardId: 'shard-id-1',
      Shards: [
        {
          SequenceNumberRange: {
            StartingSequenceNumber: '000000000000000000001',
            EndingSequenceNumber: '000000000000000000001'
          },
          ShardId: 'shard-id-1'
        }
      ],
      StreamArn: 'stream-arn',
      StreamLabel: 'stream-label',
      StreamStatus: 'ENABLED',
      StreamViewType: 'NEW_AND_OLD_IMAGES',
      TableName: 'table-name'
    }
  },
  paginatedDescribeResult2: {
    StreamDescription: {
      LastEvaluatedShardId: 'shard-id-2',
      Shards: [
        {
          SequenceNumberRange: {
            StartingSequenceNumber: '000000000000000000003',
            EndingSequenceNumber: '000000000000000000003'
          },
          ShardId: 'shard-id-2'
        }
      ],
      StreamArn: 'stream-arn',
      StreamLabel: 'stream-label',
      StreamStatus: 'ENABLED',
      StreamViewType: 'NEW_AND_OLD_IMAGES',
      TableName: 'table-name'
    }
  },
  multishardPaginatedDescribeResult1: {
    StreamDescription: {
      LastEvaluatedShardId: 'shard-id-2',
      Shards: [
        {
          SequenceNumberRange: {
            StartingSequenceNumber: '000000000000000000001',
            EndingSequenceNumber: '000000000000000000001'
          },
          ShardId: 'shard-id-1'
        },
        {
          SequenceNumberRange: {
            StartingSequenceNumber: '000000000000000000003',
            EndingSequenceNumber: '000000000000000000003'
          },
          ShardId: 'shard-id-2'
        }
      ],
      StreamArn: 'stream-arn',
      StreamLabel: 'stream-label',
      StreamStatus: 'ENABLED',
      StreamViewType: 'NEW_AND_OLD_IMAGES',
      TableName: 'table-name'
    }
  },
  multishardPaginatedDescribeResult2: {
    StreamDescription: {
      LastEvaluatedShardId: '',
      Shards: [
        {
          SequenceNumberRange: {
            StartingSequenceNumber: '000000000000000000004',
            EndingSequenceNumber: '000000000000000000004'
          },
          ShardId: 'shard-id-3'
        },
        {
          SequenceNumberRange: {
            StartingSequenceNumber: '000000000000000000005',
            EndingSequenceNumber: '000000000000000000006'
          },
          ShardId: 'shard-id-4'
        }
      ],
      StreamArn: 'stream-arn',
      StreamLabel: 'stream-label',
      StreamStatus: 'ENABLED',
      StreamViewType: 'NEW_AND_OLD_IMAGES',
      TableName: 'table-name'
    }
  },
  multishardPaginatedDisabledDescribeResult: {
    StreamDescription: {
      LastEvaluatedShardId: '',
      Shards: [
        {
          SequenceNumberRange: {
            StartingSequenceNumber: '000000000000000000004',
            EndingSequenceNumber: '000000000000000000004'
          },
          ShardId: 'shard-id-3'
        },
        {
          SequenceNumberRange: {
            StartingSequenceNumber: '000000000000000000005',
            EndingSequenceNumber: '000000000000000000006'
          },
          ShardId: 'shard-id-4'
        }
      ],
      StreamArn: 'stream-arn',
      StreamLabel: 'stream-label',
      StreamStatus: 'DISABLED',
      StreamViewType: 'NEW_AND_OLD_IMAGES',
      TableName: 'table-name'
    }
  }
};
