const tenderlyId = 'd0852fd4-e587-4826-8765-9c80348cec8d';
const apiUrl = `${process.env.BACKEND_TENDERLY_API}/preview/backends`;
export const proxyUrl = `${process.env.BACKEND_TENDERLY_API}/v1/proxy/${tenderlyId}/`;

export const doesBackendExist = async () => {
  console.log('Fetch', `${apiUrl}/${tenderlyId}`);
  const res = await fetch(`${apiUrl}/${tenderlyId}`);
  if (!res.ok) return false;
  const result = await res.json();
  console.log(result);
  return result.status === 'ready';
};

export const waitForBackend = async () => {
  const res = await fetch(apiUrl, {
    method: 'POST',
    body: JSON.stringify({ tenderlyId }),
  });
  if (!res.ok) throw new Error('Could not create backend');
  const max = Date.now() + 10 * 60 * 1000; // in 10min
  let ready = false;
  while (!ready && max > Date.now()) {
    await new Promise((res) => setTimeout(res, 30_000)); // every 30sec
    ready = await doesBackendExist();
  }
  if (!ready)
    throw new Error('Timedout: wait too long for backend to be creating');
};
