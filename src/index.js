import R from 'ramda';
import flyd from 'flyd';
import { fromJS, Seq, Map } from 'immutable';
import WebSocket from 'universal-websocket-client';

/**
 * Converts a Signal K path to an immutable Seq
 *
 * @param {string} path
 * @returns {immutable.Seq.Indexed}
 */
const pathToSeq = R.memoize(
  R.compose(
    R.constructN(1, Seq),
    R.filter(R.identity),
    R.split('.')
  )
);

/**
 * Apply delta message to state
 *
 * @param {immutable.Map} state
 * @param {immutable.Map} message
 * @returns {immutable.Map} new state
 */
const update = (state, message) => message.get(
  'updates'
).flatMap(
  update => update.get(
    'values'
  ).map(
    value => [
      pathToSeq(
        message.get('context', 'self')
      ).concat(
        pathToSeq(value.get('path'))
      ),
      value.get('value')
    ]
  )
).reduce(
  (state, update) => state.setIn(...update),
  state
);

/**
 * Connects to an endpoint, and returns a stream of single-update deltas.
 * Messages can be sent to the endpoint via the write stream.
 *
 * @param {string} url
 * @param {flyd.stream} writeStream outgoing data stream
 * @returns {flyd.stream<immutable.Map>}
 */
const connection = (url, writeStream) => {
  const readStream = flyd.stream();
  const socket = new WebSocket(url);
  socket.addEventListener('message', R.compose(
    readStream,
    fromJS,
    JSON.parse,
    R.prop('data')
  ));
  socket.addEventListener('close', R.compose(
    R.tap(writeStream.end),
    R.tap(readStream.end),
    R.always(true)
  ));
  flyd.on(socket.close, writeStream.end);
  flyd.on(socket.close, readStream.end);
  writeStream.map(JSON.parse).map(socket.send);
  return readStream;
};

/**
 * Connects to a Signal K delta endpoint, and streams immutable states.
 * Accepts a flyd stream for sending data back to the delta endpoint.
 *
 * @param {string} url
 * @param {object} options
 * @param {flyd.stream} [options.writeStream=flyd.stream] outgoing data stream
 * @returns {flyd.stream<immutable.Map>}
 */
const kumara = (url, {
  writeStream = flyd.stream()
} = {}) => flyd.scan(
  (state, [direction, message]) => {
    if (!state.has('statistics')) { // Initial update
      return fromJS({
        statistics: {
          errors: 0,
          sent: 0,
          received: 0,
          [direction]: 1
        },
        server: message
      });
    }
    const newState = state.updateIn(
      ['statistics', direction],
      R.add(1)
    );
    if (direction === 'sent') return newState;
    return update(newState, message);
  },
  new Map(),
  flyd.merge(
    writeStream.map(v => ['sent', v]),
    connection(url, writeStream).map(v => ['received', v])
  )
);

export {
  pathToSeq,
  update,
  connection
};
export default kumara;
