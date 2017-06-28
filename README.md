# 🍠 Kūmara [![CircleCI](https://circleci.com/gh/neftaly/kumara.svg?style=shield)](https://circleci.com/gh/neftaly/kumara)

```js
import kumara from 'kumara';

kumara(
  'ws://demo.signalk.org/signalk/v1/stream?subscribe=all'
).map(
  state => state.toJS()
).map(
  state => JSON.stringify(state, null, 2)
).map(
  state => console.log('\n###', state)
);
```
