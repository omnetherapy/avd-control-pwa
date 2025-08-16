import { ClientSecretCredential } from "@azure/identity";
import { ComputeManagementClient } from "@azure/arm-compute";

// 🔧 Environment variables
const subscriptionId = process.env.SUBSCRIPTION_ID;
const resourceGroupName = process.env.RESOURCE_GROUP;
const vmName = process.env.VM_NAME;
const clientId = process.env.CLIENT_ID;
const clientSecret = process.env.CLIENT_SECRET;
const tenantId = process.env.TENANT_ID;

// Authenticate with service principal
const credential = new ClientSecretCredential(tenantId, clientId, clientSecret);
const client = new ComputeManagementClient(credential, subscriptionId);

// ---- Start VM ----
export async function startAvd() {
  const poller = await client.virtualMachines.beginStart(resourceGroupName, vmName);
  await poller.pollUntilDone();
  return { message: `VM ${vmName} started successfully` };
}

// ---- Stop VM ----
export async function stopAvd() {
  const poller = await client.virtualMachines.beginPowerOff(resourceGroupName, vmName);
  await poller.pollUntilDone();
  return { message: `VM ${vmName} stopped successfully` };
}

// ---- Get Status ----
export async function getAvdStatus() {
  const instanceView = await client.virtualMachines.instanceView(resourceGroupName, vmName);
  const statuses = instanceView.statuses?.map(s => s.displayStatus) || [];
  return { vm: vmName, statuses };
}
