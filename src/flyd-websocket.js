import flyd from 'flyd';
import WebSocket from 'universal-websocket-client';

/**
 * Connects to a websocket endpoint, and returns a stream of messages.
 * Message strings can be sent back to the endpoint via the write stream.
 *
 * TODO: Publish as a separate module
 *
 * @param {string} url
 * @param {string|array} protocols
 * @param {flyd.stream} writeStream outgoing data stream
 * @returns {flyd.stream<string>}
 */
const flydWebsocket = (
  url,
  protocols,
  writeStream = flyd.stream()
) => {
  const readStream = flyd.stream();
  const socket = new WebSocket(url, protocols);
  socket.addEventListener(
    'message',
    ({ data }) => readStream(data)
  );
  socket.addEventListener('close', () => readStream.end(true));
  flyd.on(() => socket.close(), writeStream.end);
  flyd.on(() => socket.close(), readStream.end);
  writeStream.map(socket.send);
  return readStream;
};

export default flydWebsocket;
