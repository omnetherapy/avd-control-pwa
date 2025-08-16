// /api/avd/avdService.js
import { ClientSecretCredential } from "@azure/identity";
import { ComputeManagementClient } from "@azure/arm-compute";

/**
 * Required environment variables (set these in Static Web App configuration)
 * - SUBSCRIPTION_ID
 * - RESOURCE_GROUP
 * - VM_NAME
 * - CLIENT_ID
 * - CLIENT_SECRET
 * - TENANT_ID
 * Optional:
 * - POLL_TIMEOUT_MS (defaults to 300000 = 5 minutes)
 */

const {
  SUBSCRIPTION_ID,
  RESOURCE_GROUP,
  VM_NAME,
  CLIENT_ID,
  CLIENT_SECRET,
  TENANT_ID,
  POLL_TIMEOUT_MS = '300000'
} = process.env;

// Validate environment
function missingEnv(name) {
  throw new Error(`Missing required environment variable: ${name}`);
}
if (!SUBSCRIPTION_ID) missingEnv('SUBSCRIPTION_ID');
if (!RESOURCE_GROUP)  missingEnv('RESOURCE_GROUP');
if (!VM_NAME)         missingEnv('VM_NAME');
if (!CLIENT_ID)       missingEnv('CLIENT_ID');
if (!CLIENT_SECRET)   missingEnv('CLIENT_SECRET');
if (!TENANT_ID)       missingEnv('TENANT_ID');

const POLL_TIMEOUT = Number(POLL_TIMEOUT_MS) || 300000; // ms

// create credential + client
const credential = new ClientSecretCredential(TENANT_ID, CLIENT_ID, CLIENT_SECRET);
const client = new ComputeManagementClient(credential, SUBSCRIPTION_ID);

// helper to add a timeout to promises
function withTimeout(promise, ms, opName) {
  const timeout = new Promise((_, reject) => {
    const t = setTimeout(() => reject(new Error(`${opName} timed out after ${ms} ms`)), ms);
    // ensure timeout cleared if promise resolves/rejects
    promise.finally(() => clearTimeout(t));
  });
  return Promise.race([promise, timeout]);
}

function wrapError(fnName, err) {
  const msg = err && err.message ? err.message : String(err);
  return new Error(`avdService.${fnName} failed: ${msg}`);
}

// ---- Start VM ----
export async function startAvd() {
  try {
    const poller = await client.virtualMachines.beginStart(RESOURCE_GROUP, VM_NAME);
    await withTimeout(poller.pollUntilDone(), POLL_TIMEOUT, 'startAvd');
    return { vm: VM_NAME, message: `VM ${VM_NAME} started` };
  } catch (err) {
    throw wrapError('startAvd', err);
  }
}

// ---- Stop VM ----
export async function stopAvd() {
  try {
    const poller = await client.virtualMachines.beginPowerOff(RESOURCE_GROUP, VM_NAME);
    await withTimeout(poller.pollUntilDone(), POLL_TIMEOUT, 'stopAvd');
    return { vm: VM_NAME, message: `VM ${VM_NAME} stopped` };
  } catch (err) {
    throw wrapError('stopAvd', err);
  }
}

// ---- Get Status ----
export async function getAvdStatus() {
  try {
    const instanceView = await client.virtualMachines.instanceView(RESOURCE_GROUP, VM_NAME);
    const statuses = (instanceView.statuses || []).map(s => ({
      code: s.code,
      displayStatus: s.displayStatus,
      time: s.time
    }));
    const powerState = statuses.find(s => String(s.code).toLowerCase().includes('powerstate'))?.displayStatus || null;
    return { vm: VM_NAME, powerState, statuses };
  } catch (err) {
    throw wrapError('getAvdStatus', err);
  }
}
