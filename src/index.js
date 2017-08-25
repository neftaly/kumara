import R from 'ramda';
import { fromJS, Seq, List } from 'immutable';
import flyd from 'flyd';
import filter from 'flyd/module/filter';
import { wsstream } from './lib';

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
 * @curried
 * @param {immutable.Map} [message=empty]
 * @param {immutable.Map} state
 * @returns {immutable.Map} new state
 */
const update = R.curry(
  (message, state) => message.get(
    'updates',
    new List()
  ).flatMap(
    // Convert vales to a flat list of updates
    update => update.get(
      'values'
    ).map(
      // Turn value into a [ path, value ] array
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
    // Apply [ path, value ] arrays to state
    (state, update) => state.setIn(...update),
    state
  )
);

/**
 * Apply messages to state object
 *
 * @param {immutable.Map} [state=immutable.Map]
 * @param {Object[]} details
 * @param {string} details[].direction sent or received
 * @param {immutable.Map} details[].message
 * @returns {immutable.Map}
 */
const applyMessage = (state, [direction, message]) => R.compose(
  direction === 'received' // Don't apply outgoing messages to state
    ? update(message)
    : R.identity,
  state => state.updateIn(['statistics', direction], R.add(1)), // Update stats
  R.when( // Setup default state for first message
    R.isNil,
    () => fromJS({
      server: message,
      statistics: { errors: 0, sent: 0, received: 0 }
    })
  )
)(state);

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
} = {}) => R.compose(
  R.tap(s => flyd.on(writeStream.end, s.end)), // TODO: Find a cleaner approach for connecting stream.ends
  filter(R.identity),
  flyd.scan(applyMessage, undefined),
  readStream => flyd.merge( // Tag messages as incoming or outgoing, then merge
    writeStream.map(R.pair('sent')),
    readStream.map(R.pair('received'))
  ),
  R.map(fromJS),
  wsstream
)(
  url, writeStream
);

export {
  pathToSeq,
  update,
  applyMessage
};
export default kumara;
