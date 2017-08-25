import R from 'ramda';
import flyd from 'flyd';
import WebSocket from 'universal-websocket-client';

/**
 * Connects to a websocket endpoint, and returns a stream of messages.
 * Messages can be sent back to the endpoint via the write stream.
 *
 * @param {string} url
 * @param {flyd.stream} writeStream outgoing data stream
 * @returns {flyd.stream<object>}
 */
const wsstream = (url, writeStream) => {
  const readStream = flyd.stream();
  const socket = new WebSocket(url);
  socket.addEventListener('message', R.compose(
    readStream,
    JSON.parse,
    R.prop('data')
  ));
  socket.addEventListener('close', () => readStream.end(true));
  flyd.on(() => socket.close(), writeStream.end);
  flyd.on(() => socket.close(), readStream.end);
  writeStream.map(JSON.parse).map(socket.send);
  return readStream;
};

export {
  wsstream
};
