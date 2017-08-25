import tape from 'tape';
import R from 'ramda';
import flyd from 'flyd';
import kumara from '../src';

tape.test('Send data', test => {
  test.plan(1);
  test.skip('todo');
  test.end();
});

tape.test('Receive data', test => {
  test.plan(3);

  let id = -1;
  const writeStream = flyd.stream();
  const stream = kumara(
    'ws://demo.signalk.org/signalk/v1/stream?subscribe=all',
    { writeStream }
  );

  stream.map(
    state => state && R.compose(
      R.dissocPath(['server', 'version']),
      R.dissocPath(['server', 'timestamp'])
    )(
      state.toJS()
    )
  ).map(
    data => {
      if (!data) return;
      id = id + 1;
      switch (id) {
        case 0:
          return test.deepEqual(
            data,
            {
              'statistics': {
                'errors': 0,
                'sent': 0,
                'received': 1
              },
              'server': {
                'name': 'signalk-server',
                'self': 'urn:mrn:signalk:uuid:c0d79334-4e25-4245-8892-54e8ccc8021d',
                'roles': [
                  'master',
                  'main'
                ]
              }
            },
            'Initial message received'
          );
        case 1:
          return test.deepEqual(
            R.dissoc('vessels', data),
            {
              'statistics': {
                'errors': 0,
                'sent': 0,
                'received': 2
              },
              'server': {
                'name': 'signalk-server',
                'self': 'urn:mrn:signalk:uuid:c0d79334-4e25-4245-8892-54e8ccc8021d',
                'roles': [
                  'master',
                  'main'
                ]
              }
            },
            'Initial vessel data received'
          );
        default:
          return stream.end(true);
      }
    }
  );

  flyd.on(
    () => {
      test.pass('Stream closed correctly');
      test.end();
    },
    stream.end
  );
});

// kumara('ws://demo.signalk.org/signalk/v1/stream?subscribe=all').map(
//   state => state.toJS()
// ).map(
//   state => JSON.stringify(state, null, 2)
// ).map(
//   state => console.warn('\n###', state)
// );
