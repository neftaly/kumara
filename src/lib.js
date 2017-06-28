import R from 'ramda';
import flyd from 'flyd';
import { fromJS, Seq } from 'immutable';
import WebSocket from 'universal-websocket-client';

/**
 * Converts full/sparse messages to delta messages.
 *
 * @param {object} message any type
 * @returns {object} message delta
 */
const fullToDelta = R.unless(
  R.prop('updates'),
  ({
    self,
    source,
    sources,
    timestamp,
    version,
    ...vessel
  }) => ({
    context: '',
    updates: [{
      source,
      timestamp,
      values: R.compose(
        R.map(([ path, value ]) => ({ path, value })),
        R.toPairs
      )({
        sources,
        self,
        version,
        ['vessels.' + self]: vessel
      })
    }]
  })
);

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
 * Converts a single delta with multiple updates,
 * into multiple deltas with a single update.
 *
 * @param {object} delta
 * @returns {immutable.Seq.Indexed} collection of single-update deltas
 */
const normalize = message => message.get(
  'updates'
).flatMap(
  update => update.get(
    'values'
  ).toSeq().map(
    value => update.delete(
      'values'
    ).set(
      'value', value.get('value')
    ).set(
      'path',
      pathToSeq(
        message.get('context', 'self')
      ).concat(
        pathToSeq(value.get('path'))
      )
    )
  )
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
    R.map(readStream),
    normalize,
    fromJS,
    fullToDelta,
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

export {
  fullToDelta,
  pathToSeq,
  normalize,
  connection
};
