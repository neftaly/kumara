# 🍠 Kūmara [![CircleCI](https://circleci.com/gh/neftaly/kumara.svg?style=shield)](https://circleci.com/gh/neftaly/kumara)

Kumara is a streaming [Signal K](http://signalk.org) implementation.
It connects to a sK server, and returns a live-updating sK state object.

You can also send messages back to the server, such as subscribe/unsubscribe requests, or commands for connected devices.

## API
### `kumara` (**url**, **options**)
* *serverUrl*: sK server URL
* *options*: optional options object
  * *writeStream*: Flyd stream of outgoing sK messages
  * *subscribe*: Subscription list (default: all)

Returns [Flyd](https://github.com/paldepind/flyd) stream of [immutable](https://facebook.github.io/immutable-js/) sK states.

## Example
```js
import kumara from 'kumara';
import flyd from 'flyd';

const writeStream = flyd.stream();

const sK = kumara('http://demo.signalk.org/signalk', {
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
  "version": "0.1.25",
  "self": "urn:mrn:signalk:uuid:c0d79334-4e25-4245-8892-54e8ccc8021d",
  "vessels": {
    "urn:mrn:signalk:uuid:c0d79334-4e25-4245-8892-54e8ccc8021d": {
      "environment": {
        "current": {
          "meta": {
            "label": "Current Vector (Set & Drift)",
            "units": "m/s",
            "convertTo": "kt",
            "min": 0,
            "max": 30
          },
          "setTrue": 2.1276,
          "drift": 0.37,
          "$source": "n2kFromFile.160",
          "timestamp": "2014-08-15T19:08:03.182",
          "pgn": 130577,
          "value": 13.269
        }
      }
    }
  },
  "atons": {
    "urn:mrn:imo:mmsi:undefined": {
      "mmsi": "undefined",
      "navigation": {
        "position": {
          "longitude": null,
          "latitude": null,
          "$source": "n2kFromFile.43",
          "timestamp": "2014-08-15T19:08:01.956",
          "pgn": 129041
        }
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
    state.get('self'), // Lookup ID of current vessel
    'environment',
    'wind',
    'value'
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
