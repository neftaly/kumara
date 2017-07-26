const tape = require('tape');
const kumara = require('../src').default;

tape.test('todo', test => {
  test.plan(1);
  test.skip('todo');
});

kumara('ws://demo.signalk.org/signalk/v1/stream?subscribe=all').map(
  state => state.toJS()
).map(
  state => JSON.stringify(state, null, 2)
).map(
  state => console.warn('\n###', state)
);
