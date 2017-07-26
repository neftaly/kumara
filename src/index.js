import flyd from 'flyd';
import { Map } from 'immutable';
import { connection } from './lib';

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
  (state, message) => state.setIn(
    message.get('path'),
    message.get('value')
  ),
  new Map(),
  connection(url, writeStream)
);

export default kumara;
