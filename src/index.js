import R from 'ramda';
import flyd from 'flyd';
import { List, Map } from 'immutable';
import { connection } from './lib';

/**
 * Connects to a Signal K delta endpoint, and streams immutable states.
 * Accepts a flyd stream for sending data back to the delta endpoint.
 * Can optionally log prior updates.
 *
 * @param {string} url
 * @param {object} options
 * @param {flyd.stream} [options.writeStream=flyd.stream] outgoing data stream
 * @param {number} [options.logSize=0] max size of event log
 * @returns {flyd.stream<immutable.Map>}
 */
const kumara = (url, {
  writeStream = flyd.stream(),
  logSize = 0
}) => flyd.scan(
  (state, message) => state.setIn(
    message.get('path'),
    message.get('value')
  ).update(
    'log',
    new List(),
    log => logSize > 0
      ? log.push(message).takeLast(logSize)
      : R.identity
  ),
  new Map(),
  connection(url, writeStream)
);

export default kumara;
