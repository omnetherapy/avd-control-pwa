// api/avd-status/index.js  (diagnostic)
const { ClientSecretCredential } = require("@azure/identity");
const axios = require("axios");

module.exports = async function (context, req) {
  try {
    const env = {
      TENANT_ID: !!process.env.TENANT_ID,
      CLIENT_ID: !!process.env.CLIENT_ID,
      CLIENT_SECRET: !!process.env.CLIENT_SECRET,
      SUBSCRIPTION_ID: !!process.env.SUBSCRIPTION_ID,
      RESOURCE_GROUP: !!process.env.RESOURCE_GROUP,
      VM_NAME: !!process.env.VM_NAME
    };
    context.log("env presence:", env);

    // Try to get a token (but DO NOT return the token value)
    let tokenOk = false;
    try {
      const cred = new ClientSecretCredential(process.env.TENANT_ID, process.env.CLIENT_ID, process.env.CLIENT_SECRET);
      const tr = await cred.getToken("https://management.azure.com/.default");
      tokenOk = !!tr && !!tr.token;
      context.log("token acquired:", tokenOk);
    } catch (tokenErr) {
      context.log("token error:", tokenErr.message);
      return context.res = {
        status: 500,
        headers: { "Content-Type": "application/json" },
        body: { success: false, step: "getToken", env, error: tokenErr.message, axiosResponse: tokenErr.response?.data || null }
      };
    }

    // Try to call the instanceView API
    try {
      const tokenResp = await (new ClientSecretCredential(process.env.TENANT_ID, process.env.CLIENT_ID, process.env.CLIENT_SECRET))
        .getToken("https://management.azure.com/.default");
      const url = `https://management.azure.com/subscriptions/${process.env.SUBSCRIPTION_ID}/resourceGroups/${process.env.RESOURCE_GROUP}/providers/Microsoft.Compute/virtualMachines/${process.env.VM_NAME}/instanceView?api-version=2023-09-01`;
      const r = await axios.get(url, { headers: { Authorization: `Bearer ${tokenResp.token}` } });

      // success: return instanceView (ok for debugging)
      return context.res = {
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: { success: true, env, instanceView: r.data }
      };
    } catch (apiErr) {
      context.log("instanceView error:", apiErr.message, apiErr.response?.status);
      return context.res = {
        status: 500,
        headers: { "Content-Type": "application/json" },
        body: { success: false, step: "instanceView", env, status: apiErr.response?.status || null, data: apiErr.response?.data || null, message: apiErr.message }
      };
    }

  } catch (err) {
    context.log("fatal error:", err);
    context.res = { status: 500, headers:{ "Content-Type": "application/json" }, body: { success:false, error: err.message } };
  }
};
