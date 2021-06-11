'use strict';
const Assert = require('assert');


class MockClient {
  constructor (results) {
    Assert(Array.isArray(results), 'mock results array is required');
    this.results = results;
    this.calls = [];
  }

  listStreams (options) {
    this.calls.push({ call: 'listStreams', options });
    return promisifiableResult(this.results.shift());
  }

  describeStream (options) {
    this.calls.push({ call: 'describeStream', options });
    return promisifiableResult(this.results.shift());
  }

  getShardIterator (options) {
    this.calls.push({ call: 'getShardIterator', options });
    return promisifiableResult(this.results.shift());
  }

  getRecords (options) {
    this.calls.push({ call: 'getRecords', options });
    return promisifiableResult(this.results.shift());
  }

  _getCallsByName (name) {
    return this.calls.filter((call) => {
      return call.call === name;
    });
  }
}


function promisifiableResult (result) {
  return {
    promise () {
      return new Promise((resolve, reject) => {
        if (result === undefined) {
          // Do nothing, but leave the Promise state pending.
          return;
        }

        if (result instanceof Error) {
          return reject(result);
        }

        resolve(result);
      });
    }
  };
}


module.exports = { MockClient };
