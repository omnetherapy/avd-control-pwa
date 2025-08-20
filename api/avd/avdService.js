const { ClientSecretCredential } = require("@azure/identity");
const { ComputeManagementClient } = require("@azure/arm-compute");

const {
  SUBSCRIPTION_ID,
  RESOURCE_GROUP,
  VM_NAME,
  CLIENT_ID,
  CLIENT_SECRET,
  TENANT_ID,
  POLL_TIMEOUT_MS = '300000'
} = process.env;

if (!SUBSCRIPTION_ID)   throw new Error('Missing SUBSCRIPTION_ID');
if (!RESOURCE_GROUP)    throw new Error('Missing RESOURCE_GROUP');
if (!VM_NAME)           throw new Error('Missing VM_NAME');
if (!CLIENT_ID)         throw new Error('Missing CLIENT_ID');
if (!CLIENT_SECRET)     throw new Error('Missing CLIENT_SECRET');
if (!TENANT_ID)         throw new Error('Missing TENANT_ID');

const credential = new ClientSecretCredential(TENANT_ID, CLIENT_ID, CLIENT_SECRET);
const client     = new ComputeManagementClient(credential, SUBSCRIPTION_ID);
const POLL_TIMEOUT = Number(POLL_TIMEOUT_MS) || 300000;

function withTimeout(promise, ms, name) {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`${name} timed out after ${ms}ms`)), ms)
  );
  return Promise.race([promise, timeout]);
}

async function startAvd() {
  const poller = await client.virtualMachines.beginStart(RESOURCE_GROUP, VM_NAME);
  await withTimeout(poller.pollUntilDone(), POLL_TIMEOUT, 'startAvd');
  return { vm: VM_NAME, message: `VM ${VM_NAME} started` };
}

async function stopAvd() {
  const poller = await client.virtualMachines.beginPowerOff(RESOURCE_GROUP, VM_NAME);
  await withTimeout(poller.pollUntilDone(), POLL_TIMEOUT, 'stopAvd');
  return { vm: VM_NAME, message: `VM ${VM_NAME} stopped` };
}

async function getAvdStatus() {
  const iv = await client.virtualMachines.instanceView(RESOURCE_GROUP, VM_NAME);
  const statuses = (iv.statuses || []).map(s => ({
    code: s.code,
    displayStatus: s.displayStatus,
    time: s.time
  }));
  const powerState = statuses.find(s => /powerstate/i.test(s.code))?.displayStatus || null;
  return { vm: VM_NAME, powerState, statuses };
}

module.exports = { startAvd, stopAvd, getAvdStatus };
