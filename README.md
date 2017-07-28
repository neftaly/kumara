# 🍠 Kūmara [![CircleCI](https://circleci.com/gh/neftaly/kumara.svg?style=shield)](https://circleci.com/gh/neftaly/kumara)

Kumara is a streaming [Signal K](http://signalk.org) implementation.
It connects to a [sK delta stream](http://signalk.org/specification/master/streaming_api.html) and returns a live-updating sK state object.

You can also send messages back to the server, such as subscribe/unsubscribe requests, or commands for connected devices.

## API
### `kumara` (**url**, **options**)
* *url*: sK websocket URL
* *url*: optional options object
  * *writeStream*: Flyd stream of outgoing sK messages

Returns [Flyd](https://github.com/paldepind/flyd) stream of [immutable](https://facebook.github.io/immutable-js/) sK states, with an additional 'statistics' property.

## Example
```js
import kumara from 'kumara';
import flyd from 'flyd';

const writeStream = flyd.stream();

const sK = kumara('ws://demo.signalk.org/signalk/v1/stream?subscribe=all', {
  writeStream // Optional 
});

sK.map(
  state => state.toJS() // Convert immutable to plain JS object
).map(
  state => JSON.stringify(state, null, 2)
).map(
  state => console.log('\n###', state)
);
```

This would return a bunch of messages such as the following:
```json
{
  "statistics": {
    "errors": 0,
    "sent": 0,
    "received": 3
  },
  "server": {
    "name": "signalk-server",
    "version": "0.1.25",
    "timestamp": "2017-07-28T01:37:08.882Z",
    "self": "urn:mrn:signalk:uuid:c0d79334-4e25-4245-8892-54e8ccc8021d",
    "roles": [
      "master",
      "main"
    ]
  },
  "vessels": {
    "urn:mrn:imo:mmsi:230053990": {
      "navigation": {
        "speedOverGround": 3.65,
        "courseOverGroundTrue": 3.3667,
        "position": {
          "longitude": 24.7194917,
          "latitude": 59.67997
        }
      }
    },
    "urn:mrn:signalk:uuid:c0d79334-4e25-4245-8892-54e8ccc8021d": {
      "environment": {
        "wind": {
          "speedApparent": 6.38,
          "angleApparent": 0.646
        }
      }
    }
  }
```

To look up the wind data of the current vessel:

```js
sK.map(
  // Equivalent of `state.vessels[state.server.self].environment.wind`
  state => state.getIn([
    'vessels',
    state.getIn(['server', 'self']), // Lookup ID of current vessel
    'environment',
    'wind'
  ])
).map(
  wind => wind.toJS()
).map(
  console.log
);
// => { "speedApparent": 6.38, "angleApparent": 0.646 }
```

You can also send data back to the server:
```js
// Subscribe to a particular topic
writeStream({
  context: 'vessels.self',
  subscribe: [
    {
      path: 'navigation.speedThroughWater',
      period: 1000,
      format: 'delta',
      policy: 'ideal',
      minPeriod: 200
    },
    {
      path: 'navigation.logTrip',
      period: 10000
    }
  ]
});

// Write a bit of data (change autopilot bearing, etc)
writeStream({
  context: 'vessels',
  put: [
    {
      source: {
        pgn: '128275',
        device: '/dev/actisense',
        timestamp: '2014-08-15-16:00:05.538',
        src: '115'
      },
      values: [
        {
          path: 'navigation.logTrip',
          value: 43374
        }
      ]
    }
  ]
});
```
