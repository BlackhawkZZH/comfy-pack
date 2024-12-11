import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

const spinner = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24">
  <path fill="currentColor" d="M12,1A11,11,0,1,0,23,12,11,11,0,0,0,12,1Zm0,19a8,8,0,1,1,8-8A8,8,0,0,1,12,20Z" opacity=".25"/>
  <path fill="currentColor" d="M10.14,1.16a11,11,0,0,0-9,8.92A1.59,1.59,0,0,0,2.46,12,1.52,1.52,0,0,0,4.11,10.7a8,8,0,0,1,6.66-6.61A1.42,1.42,0,0,0,12,2.69h0A1.57,1.57,0,0,0,10.14,1.16Z">
    <animateTransform attributeName="transform" dur="0.75s" repeatCount="indefinite" type="rotate" values="0 12 12;360 12 12"/>
  </path>
</svg>`

const style = `
.cpack-modal {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: #1a1a1a;
  padding: 20px;
  border-radius: 8px;
  z-index: 1000;
  color: white;
  min-width: 360px;
}

.cpack-input {
  width: 100%;
  padding: 8px;
  background: #333;
  border: 1px solid #444;
  border-radius: 4px;
  color: white;
  box-sizing: border-box;
}

.cpack-btn {
  padding: 6px 12px;
  background: #666;
  border: none;
  border-radius: 4px;
  color: white;
  cursor: pointer;
}

.cpack-btn.primary {
  background: #00a67d;
}

.cpack-btn.primary:disabled {
  background: #81a39b;
  cursor: not-allowed;
}

.cpack-btn-container {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.cpack-title {
  margin-bottom: 15px;
  font-size: 1.3em;
  font-weight: bold;
}

.cpack-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 999;
}

.cpack-input-row {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-bottom: 5px;
}

.cpack-form-item {
  margin-bottom: 15px;
}

.cpack-form-item label {
  margin-bottom: 5px;
}

.cpack-form-item.required label::after {
  content: "*";
  color: #ff8383;
}

#build-info {
  display: flex;
  padding: 10px;
  flex-direction: column;
  align-items: center;
}

#build-error {
  display: none;
  color: #ff8383;
  text-wrap: auto;
  overflow-x: auto;
  background: #333;
  padding: 10px;
}

.cpack-copyable {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 5px;
}

.cpack-copyable > span {
  border: 1px solid #ccc;
  padding: 3px 10px;
  border-radius: 3px;
  background: #606060;
}

.error-message {
  color: #ff8383;
  margin-top: 5px;
  display: none;
  font-size: 0.9em;
}
`

class ModelList {
  constructor(container, countId) {
    this.container = container;
    this.countId = countId;
    this.init();
  }

  init() {
    this.container.style.cssText = `
      max-height: 300px;
      overflow-y: auto;
      border: 1px solid #444;
      border-radius: 4px;
      padding: 5px;
    `;
  }

  async load() {
    try {
      const { workflow, output: workflow_api } = await app.graphToPrompt();
      const resp = await api.fetchApi("/bentoml/model/query", {
        method: "POST",
        body: JSON.stringify({ workflow, workflow_api }),
        headers: { "Content-Type": "application/json" }
      });
      const data = await resp.json();
      const models = Array.isArray(data) ? data : (data.models || []);
      this.renderModels(this.sortModels(models));
    } catch(e) {
      this.container.innerHTML = `<div style="color: #ff8383">Failed to load models: ${e.message}</div>`;
    }
  }

  sortModels(models) {
    return models.sort((a, b) => {
      if (a.refered && !b.refered) return -1;
      if (!a.refered && b.refered) return 1;
      const timeA = Math.max(a.atime || 0, a.ctime || 0);
      const timeB = Math.max(b.atime || 0, b.ctime || 0);
      return timeB - timeA;
    });
  }

  renderModels(models) {
    const now = Date.now() / 1000;
    const ONE_DAY = 24 * 60 * 60;

    this.container.innerHTML = this.getSelectAllHtml() +
      models.map(model => this.getModelItemHtml(model, now, ONE_DAY)).join('');

    this.setupEventListeners();
    this.updateCount();
  }

  getSelectAllHtml() {
    return `
      <div style="padding: 6px 0; border-bottom: 1px solid #444; margin-bottom: 5px;">
        <label style="display: flex; align-items: center;">
          <input type="checkbox" id="select-all-models" style="margin-right: 8px;" />
          <span>Select All</span>
        </label>
      </div>
    `;
  }

  getModelItemHtml(model, now, ONE_DAY) {
    const size = (model.size / (1024 * 1024)).toFixed(2);
    const path = String(model.filename || '');
    const name = path ? path.split('/').pop() : 'Unknown';
    const isRecentlyAccessed = (now - (model.atime || 0)) < ONE_DAY;

    return `
      <div style="padding: 6px 0; border-bottom: 1px solid #333;">
        <label style="display: flex; align-items: flex-start;">
          <input type="checkbox" name="models" value="${path}"
            style="margin-top: 4px;"
            ${isRecentlyAccessed || model.refered ? 'checked' : ''} />
          <div style="margin-left: 8px;">
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: nowrap; overflow-x: auto;">
              <div style="font-weight: bold; white-space: nowrap;">${name}</div>
              ${isRecentlyAccessed ? `<span style="background: #00a67d33; color: #00a67d; padding: 2px 6px; border-radius: 4px; font-size: 0.8em; cursor: help; white-space: nowrap;" title="Accessed in ${Math.round((now - (model.atime || 0)) / 3600)} hours">Recent</span>` : ''}
              ${model.refered ? `<span style="background: #a67d0033; color: #a67d00; padding: 2px 6px; border-radius: 4px; font-size: 0.8em; cursor: help; white-space: nowrap;" title="Mentioned in node inputs">Referenced</span>` : ''}
            </div>
            <div style="display: flex; align-items: center; gap: 8px; margin-top: 4px;">
              <div style="color: #888; font-size: 0.9em; flex: 1; overflow-x: hidden; text-overflow: ellipsis; display: flex; align-items: center; gap: 4px;">
                <span style="background: #333; padding: 2px 6px; border-radius: 4px; display: flex; align-items: center; gap: 4px; white-space: nowrap;">
                  <svg style="width: 14px; height: 14px; min-width: 14px;" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M6,2H18A2,2 0 0,1 20,4V20A2,2 0 0,1 18,22H6A2,2 0 0,1 4,20V4A2,2 0 0,1 6,2M12,4A6,6 0 0,0 6,10C6,13.31 8.69,16 12.1,16L11.22,13.77C10.95,13.29 11.11,12.68 11.59,12.4L12.45,11.9C12.93,11.63 13.54,11.79 13.82,12.27L15.74,14.69C17.12,13.59 18,11.9 18,10A6,6 0 0,0 12,4M12,9A1,1 0 0,1 13,10A1,1 0 0,1 12,11A1,1 0 0,1 11,10A1,1 0 0,1 12,9M7,18A1,1 0 0,0 6,19A1,1 0 0,0 7,20A1,1 0 0,0 8,19A1,1 0 0,0 7,18M12.09,13.27L14.58,19.58L17.17,18.08L12.95,12.77L12.09,13.27Z" />
                  </svg>
                  ${model.size ? `${size} MB` : 'Unknown size'}
                </span>
                <span style="overflow: hidden; text-overflow: ellipsis;" title="${path}">${path.substring(0, path.lastIndexOf('/') + 1)}</span>
              </div>
            </div>
          </div>
        </label>
      </div>
    `;
  }

  setupEventListeners() {
    this.container.querySelectorAll("input[name='models']").forEach(checkbox => {
      checkbox.addEventListener('change', () => this.updateCount());
    });

    const selectAllCheckbox = this.container.querySelector("#select-all-models");
    selectAllCheckbox?.addEventListener('change', (e) => {
      this.container.querySelectorAll("input[name='models']").forEach(checkbox => {
        checkbox.checked = e.target.checked;
      });
      this.updateCount();
    });
  }

  updateCount() {
    const count = this.container.querySelectorAll("input[name='models']:checked").length;
    const countSpan = document.querySelector(`[data-models-count='${this.countId}']`);
    if (countSpan) {
      countSpan.textContent = count;
    }
  }

  getSelectedModels() {
    return Array.from(this.container.querySelectorAll("input[name='models']:checked"))
      .map(input => input.value);
  }
}

function createModal(modal) {
  const overlay = document.createElement("div");
  overlay.className = "cpack-overlay";

  document.body.appendChild(overlay);
  document.body.appendChild(modal);

  return {
    close: () => {
      modal.remove();
      overlay.remove();
    }
  };
}



async function createPackModal() {
  return new Promise((resolve) => {
    const modal = document.createElement("div");
    modal.className = "cpack-modal";
    modal.id = "input-modal";

    const title = document.createElement("div");
    title.textContent = "Package Workflow";
    title.className = "cpack-title";

    const form = document.createElement("form");
    form.innerHTML = `
      <div class="cpack-form-item">
        <label for="filename">Name</label>
        <input type="text" class="cpack-input" name="filename" value="${localStorage.getItem('cpack-bento-name') || 'comfy-pack-pkg'}" />
      </div>
      <div class="cpack-form-item">
        <details>
          <summary style="cursor: pointer; margin-bottom: 10px;">Models (<span data-models-count="models-list">0</span> selected)</summary>
          <div id="models-list">
            ${spinner}
          </div>
        </details>
      </div>
    `;

    const buttonContainer = document.createElement("div");
    buttonContainer.className = "cpack-btn-container";

    const confirmButton = document.createElement("button");
    confirmButton.textContent = "Pack";
    confirmButton.className = "cpack-btn primary";
    confirmButton.disabled = true;

    const cancelButton = document.createElement("button");
    cancelButton.textContent = "Cancel";
    cancelButton.className = "cpack-btn";

    buttonContainer.appendChild(cancelButton);
    buttonContainer.appendChild(confirmButton);
    modal.appendChild(title);
    modal.appendChild(form);
    modal.appendChild(buttonContainer);

    const { close } = createModal(modal);

    const modelsList = form.querySelector("#models-list");
    const modelListComponent = new ModelList(modelsList, "models-list");
    modelListComponent.load().then(() => {
      confirmButton.disabled = false;
    });

    confirmButton.onclick = () => {
      const filename = form.querySelector("input[name='filename']").value.trim();
      if (filename) {
        // Save filename to localStorage
        localStorage.setItem('cpack-bento-name', filename);
        close();
        resolve({
          filename,
          models: Array.from(form.querySelectorAll("input[name='models']:checked")).map(input => input.value)
        });
      }
    };

    cancelButton.onclick = () => {
      close();
      resolve(null);
    };

    const filenameInput = form.querySelector("input[name='filename']");
    filenameInput.addEventListener("keyup", (e) => {
      if (e.key === "Enter") {
        confirmButton.click();
      }
    });

    filenameInput.select();
  });
}

function createDownloadModal() {
  const modal = document.createElement("div");
  modal.className = "cpack-modal";
  modal.id = "download-modal";

  const title = document.createElement("div");
  title.textContent = "Packaging...";
  title.style.marginBottom = "15px";
  title.style.color = "#fff";

  const hint = document.createElement("div");
  hint.textContent = "First run may take a few minutes to compute model checksums, depending on the number of models.";
  hint.style.cssText = "color: #888; font-size: 0.9em; margin-bottom: 15px;";

  const progress = document.createElement("div");
  progress.style.cssText = `
    width: 100%;
    height: 20px;
    background: #333;
    border-radius: 10px;
    overflow: hidden;
  `;

  const progressBar = document.createElement("div");
  progressBar.style.cssText = `
    width: 0%;
    height: 100%;
    background: #00a67d;
    transition: width 0.3s ease;
  `;

  progress.appendChild(progressBar);
  modal.appendChild(title);
  modal.appendChild(hint);
  modal.appendChild(progress);

  const { close } = createModal(modal);

  return {
    updateProgress: (percent) => {
      progressBar.style.width = `${percent}%`;
    },
    close
  };
}

async function packageAction() {
  if (document.getElementById("input-modal")) return;
  if (document.getElementById("download-modal")) return;
  const result = await createPackModal();
  if (!result) return;

  const downloadModal = createDownloadModal();

  try {
    downloadModal.updateProgress(20);
    const { workflow, output: workflow_api } = await app.graphToPrompt();

    downloadModal.updateProgress(40);
    const body = JSON.stringify({
      workflow,
      workflow_api,
      models: result.models
    });

    downloadModal.updateProgress(60);
    const resp = await api.fetchApi("/bentoml/pack", { method: "POST", body, headers: { "Content-Type": "application/json" } });

    downloadModal.updateProgress(80);
    const downloadUrl = (await resp.json())["download_url"];

    downloadModal.updateProgress(100);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = result.filename + ".cpack.zip";
    link.click();

    setTimeout(() => {
      downloadModal.close();
    }, 1000);
  } catch (error) {
    console.error("Package failed:", error);
    downloadModal.close();
  }
}

async function serveAction() {
  if (document.getElementById("serve-modal")) return;
  const modal = document.createElement("div");
  modal.id = "serve-modal";
  modal.className = "cpack-modal";
  modal.style.width = "400px";

  const title = document.createElement("div");
  title.textContent = "Serve Workflow as REST API";
  title.className = "cpack-title";

  const form = document.createElement("form");
  form.innerHTML = serveForm;

  const buttonContainer = document.createElement("div");
  buttonContainer.className = "cpack-btn-container";

  const confirmButton = document.createElement("button");
  confirmButton.textContent = "Start";
  confirmButton.className = "cpack-btn primary";

  const cancelButton = document.createElement("button");
  cancelButton.textContent = "Cancel";
  cancelButton.className = "cpack-btn";

  buttonContainer.appendChild(cancelButton);
  buttonContainer.appendChild(confirmButton);

  modal.appendChild(title);
  modal.appendChild(form);
  modal.appendChild(buttonContainer);

  const { close } = createModal(modal);
  cancelButton.onclick = close;

  form.querySelector("input[name='port']").select();
  confirmButton.onclick = async (e) => {
    e.preventDefault();
    const formData = new FormData(form);
    const { workflow, output: workflow_api } = await app.graphToPrompt();
    const data = {
      host: formData.get("allowExternal") === "on" ? "0.0.0.0" : "localhost",
      port: formData.get("port"),
      workflow,
      workflow_api
    };

    try {
      confirmButton.disabled = true;
      const resp = await api.fetchApi("/bentoml/serve", {
        method: "POST",
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json" }
      });
      const result = await resp.json();
      if (result.error) {
        const errorDiv = form.querySelector('.error-message');
        errorDiv.textContent = result.error;
        errorDiv.style.display = 'block';
      } else {
        close();
        createServeStatusModal(result.url);
      }
    } catch(e) {
      const errorDiv = form.querySelector('.error-message');
      errorDiv.textContent = e.message;
      errorDiv.style.display = 'block';
    } finally {
      confirmButton.disabled = false;
    }
  };
}

async function deployAction() {
  if (document.getElementById("build-modal")) return;
  if (document.getElementById("building-modal")) return;
  const data = await createBuildModal();
  console.log(data);
  await createBuildingModal(data);
};

const serveForm = `
<div class="cpack-form-item">
  <label>
    <input type="checkbox" name="allowExternal" />
    Allow External Access
  </label>
</div>
<div class="cpack-form-item">
  <label for="port">Port</label>
  <input type="number" class="cpack-input" name="port" value="3000" />
  <div class="error-message"></div>
</div>
`

const buildForm = `
  <p style="font-size: 0.85em; color: #888; margin-top: 5px;">
    This feature is powered by <a href="https://www.bentoml.com/?from=comfy-pack" target="_blank" style="color: #00a67d;">BentoCloud</a>, a platform for deploying <br>and managing ML services in customizable clusters
  </p>
<div class="cpack-form-item required">
  <label for="bentoName">Bento Name</label>
  <input type="text" class="cpack-input" name="bentoName" placeholder="comfy-pack-app" />
  <div class="error-message">Bento name is required</div>
</div>
<div class="cpack-form-item">
  <details>
    <summary style="cursor: pointer; margin-bottom: 10px;">Models (<span data-models-count="build-models-list">0</span> selected)</summary>
    <div id="build-models-list">
      ${spinner}
    </div>
  </details>
</div>
<div class="cpack-form-item">
  <label for="systemPackages">System Packages</label>
  <div id="system-packages-array">
    <button class="cpack-btn" id="add-button" style="margin: 5px 0px">Add</button>
  </div>
</div>
<div class="cpack-form-item required">
  <label>BentoCloud API</label>
  <div id="credentials-group" style="margin-top: 10px;">
    <div class="cpack-form-item">
      <input type="text" class="cpack-input" name="endpoint" placeholder="https://<your_org>.cloud.bentoml.com" value="${localStorage.getItem('cpack-endpoint') || ''}" required />
      <div class="error-message">Endpoint is required</div>
    </div>
    <div class="cpack-form-item">
      <input type="password" class="cpack-input" name="apiKey" placeholder="<your_token>" value="${localStorage.getItem('cpack-api-key') || ''}" required />
      <div class="error-message">API Key is required</div>
    </div>
      <p style="font-size: 0.85em; color: #888; margin-top: 5px;">
        Get your API Token at <a href="https://cloud.bentoml.com/signup?from=comfy-pack" target="_blank" style="color: #00a67d;">cloud.bentoml.com</a>
      </p>
  </div>
</div>
`

function createBuildModal() {
  const modal = document.createElement("div");
  modal.id = "build-modal";
  modal.className = "cpack-modal";

  const title = document.createElement("div");
  title.textContent = "Deploy Workflow to Cloud";
  title.className = "cpack-title";

  const form = document.createElement("form");
  form.innerHTML = buildForm;

  const addButton = form.querySelector("#add-button");
  const systemPackagesArray = form.querySelector("#system-packages-array");
  addButton.addEventListener("click", (e) => {
    e.preventDefault();
    const row = document.createElement("div");
    row.className = "cpack-input-row";
    row.innerHTML = `
      <div style="flex: 1"><input type="text" class="cpack-input" name="systemPackages" placeholder="package name in Ubuntu" /></div>
      <button class="cpack-btn" style="margin-left: 10px">Remove</button>
    `
    systemPackagesArray.appendChild(row);
    row.querySelector("button").onclick = (e) => {
      e.preventDefault();
      row.remove();
    }
  });


  const buttonContainer = document.createElement("div");
  buttonContainer.className = "cpack-btn-container";

  const confirmButton = document.createElement("button");
  confirmButton.innerHTML = `Push to Cloud`;
  confirmButton.className = "cpack-btn primary";
  confirmButton.style.fontWeight = "bold";
  confirmButton.disabled = true;

  const cancelButton = document.createElement("button");
  cancelButton.textContent = "Cancel";
  cancelButton.className = "cpack-btn";
  cancelButton.className = "cpack-btn";

  buttonContainer.appendChild(cancelButton);
  buttonContainer.appendChild(confirmButton);

  modal.appendChild(title);
  modal.appendChild(form);
  modal.appendChild(buttonContainer);

  const { close } = createModal(modal);
  cancelButton.onclick = close;
  return new Promise((resolve) => {
    form.querySelector("input[name='bentoName']").select();

    const modelsList = form.querySelector("#build-models-list");
    const modelListComponent = new ModelList(modelsList, "build-models-list");
    modelListComponent.load().then(() => {
      confirmButton.disabled = false;
    });

    confirmButton.onclick = async (e) => {
      e.preventDefault();
      const formData = new FormData(form);
      const bentoName = formData.get("bentoName");
      const endpoint = formData.get("endpoint");
      const apiKey = formData.get("apiKey");

      // Reset error messages
      form.querySelectorAll('.error-message').forEach(el => el.style.display = 'none');

      // Validate required fields
      let hasError = false;

      if (!bentoName.trim()) {
        form.querySelector('input[name="bentoName"]').nextElementSibling.style.display = 'block';
        hasError = true;
      }
      if (!endpoint.trim()) {
        form.querySelector('input[name="endpoint"]').nextElementSibling.style.display = 'block';
        hasError = true;
      }
      if (!apiKey.trim()) {
        form.querySelector('input[name="apiKey"]').nextElementSibling.style.display = 'block';
        hasError = true;
      }

      if (hasError) {
        return;
      }

      // Save values to localStorage
      localStorage.setItem('cpack-endpoint', endpoint);
      localStorage.setItem('cpack-api-key', apiKey);

      const { workflow, output: workflow_api } = await app.graphToPrompt();
      const data = {
        bento_name: bentoName,
        system_packages: Array.from(formData.getAll("systemPackages").filter(Boolean)),
        push: true,
        api_key: apiKey,
        endpoint: endpoint,
        models: Array.from(form.querySelectorAll("input[name='models']:checked")).map(input => input.value),
        workflow,
        workflow_api
      };
      close();
      resolve(data);
    }
  });
}

async function createServeStatusModal(url) {
  const modal = document.createElement("div");
  modal.className = "cpack-modal";
  modal.style.width = "400px";

  const title = document.createElement("div");
  title.textContent = "Serve Workflow as REST API";
  title.className = "cpack-title";

  const info = document.createElement("div");
  const urlObj = new URL(url);
  const currentHost = window.location.hostname;
  const port = urlObj.port;
  const displayUrl = `${currentHost}:${port}`;
  info.innerHTML = `
    <div style="margin-bottom: 15px">
      <div style="text-align: center; margin-bottom: 15px; color: #00a67d">
        🎉 Service is online! Click below to open:
      </div>
      <div style="text-align: center; margin-top: 15px">
        <a href="http://${displayUrl}" target="_blank" style="color:#00a67d;text-decoration:none;font-weight:bold;font-size:1.2em">
          ${displayUrl}
          <span style="color:#00a67d;font-size:1em">↗</span>
        </a>
      </div>
    </div>
    <div id="status-info" style="display:flex;justify-content:center;align-items:center">
      ${spinner}
    </div>
  `;

  const buttonContainer = document.createElement("div");
  buttonContainer.className = "cpack-btn-container";

  const cancelButton = document.createElement("button");
  cancelButton.textContent = "Stop Server";
  cancelButton.className = "cpack-btn";
  cancelButton.style.cssText = "background: #a63d3d; color: white; font-weight: bold";

  buttonContainer.appendChild(cancelButton);

  modal.appendChild(title);
  modal.appendChild(info);
  modal.appendChild(buttonContainer);

  const { close } = createModal(modal);

  cancelButton.onclick = async () => {
    cancelButton.disabled = true;
    cancelButton.style.background = "#666";
    try {
      await api.fetchApi("/bentoml/serve/terminate", { method: "POST" });
    } catch(e) {
      console.error("Failed to stop server:", e);
    }
    clearInterval(checkInterval);
    close();
  };

  const statusInfo = info.querySelector("#status-info");

  // Start status checking
  const checkInterval = setInterval(async () => {
    try {
      const resp = await api.fetchApi("/bentoml/serve/heartbeat", { method: "POST" });
      const status = await resp.json();
      if (status.error) {
        title.textContent = "Server Error";
        statusInfo.innerHTML = `<div style="color:#ff8383">${status.error}</div>`;
        clearInterval(checkInterval);
      }
    } catch(e) {
      title.textContent = "Status Check Error";
      statusInfo.innerHTML = `<div style="color:#ff8383">${e.message}</div>`;
      clearInterval(checkInterval);
    }
  }, 1000);
}


async function createBuildingModal(data) {
  const modal = document.createElement("div");
  modal.className = "cpack-modal";
  modal.id = "building-modal";

  const title = document.createElement("div");
  title.textContent = "Pushing...";
  title.className = "cpack-title";

  const body = document.createElement("div");
  body.innerHTML = `
    <div id="build-info"></div>
    <pre id="build-error"></pre>
  <p style="font-size: 0.85em; color: #888; margin-top: 5px;">
  First run may take several minutes to calculate model checksums, depending on the number of models.
  </p>
  `;

  const buttonContainer = document.createElement("div");
  buttonContainer.className = "cpack-btn-container";

  const closeButton = document.createElement("button");
  closeButton.textContent = "Close";
  closeButton.className = "cpack-btn";
  buttonContainer.appendChild(closeButton);

  modal.appendChild(title);
  modal.appendChild(body);
  modal.appendChild(buttonContainer);

  const { close } = createModal(modal);
  closeButton.onclick = close;
  closeButton.disabled = true;

  const info = body.querySelector("#build-info");
  const setError = (error) => {
    title.textContent = "Build Failed";
    info.style.display = "none";
    const pre = body.querySelector("#build-error");
    pre.textContent = error;
    pre.style.display = "block";
  }
  info.innerHTML = spinner;
  try {
    const resp = await api.fetchApi("/bentoml/build", {
      method: "POST",
      body: JSON.stringify(data),
      headers: { "Content-Type": "application/json" }
    });
    const respData = await resp.json();
    if (respData.error) {
      setError(respData.error);
    } else {
      title.textContent = "Push Completed";
      // Extract org name from endpoint
      const endpointUrl = new URL(data.endpoint);

      // Extract bento repo and version from bento tag
      const [repoName, version] = respData.bento.split(':');

      // Construct status URL
      const statusUrl = `${endpointUrl.origin}/bento_repositories/${repoName}/bentos/${version}`;

      info.innerHTML = `
        <div style="text-align: center; padding: 20px 0;">
          <div style="font-size: 48px; margin-bottom: 15px;">✨</div>
          <div style="color: #888; margin-bottom: 20px">
            Your workflow has been pushed to BentoCloud and is ready for deployment
          </div>

          <div style="background: #1d1d1d; padding: 15px; border-radius: 8px; margin-bottom: 20px">
            <div class="cpack-copyable">
              <span>${repoName}:${version}</span>
              <a href="${statusUrl}" target="_blank"
                style="background: #00a67d; color: white; padding: 4px 8px; border-radius: 4px; display: inline-flex; align-items: center; gap: 4px; text-decoration: none; font-size: 0.9em"
                title="View pushed Bento">
                <span>Deploy Now</span>
                <svg style="width:16px;height:16px" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M14,3V5H17.59L7.76,14.83L9.17,16.24L19,6.41V10H21V3M19,19H5V5H12V3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V12H19V19Z" />
                </svg>
              </a>
            </div>
          </div>

          <div style="display: flex; justify-content: center; gap: 10px">
            <a href="https://docs.bentoml.com/en/latest/scale-with-bentocloud/deployment/index.html?from=comfy-pack" target="_blank"
              style="color:#00a67d; text-decoration:none; display:flex; align-items:center; gap:5px">
              <span>Deployment Guide</span>
              <svg style="width:16px;height:16px" viewBox="0 0 24 24">
                <path fill="currentColor" d="M14,3V5H17.59L7.76,14.83L9.17,16.24L19,6.41V10H21V3M19,19H5V5H12V3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V12H19V19Z" />
              </svg>
            </a>
            <a href="https://cloud.bentoml.com" target="_blank"
              style="color:#00a67d; text-decoration:none; display:flex; align-items:center; gap:5px">
              <span>BentoCloud Console Home</span>
              <svg style="width:16px;height:16px" viewBox="0 0 24 24">
                <path fill="currentColor" d="M14,3V5H17.59L7.76,14.83L9.17,16.24L19,6.41V10H21V3M19,19H5V5H12V3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V12H19V19Z" />
              </svg>
            </a>
          </div>
        </div>
      `;
    }
  } catch(e) {
    setError(e.message);
  } finally {
    closeButton.disabled = false;
  }
}

app.registerExtension({
  name: "Comfy.CPackExtension",

  async setup() {
    const styleTag = document.createElement("style");
    styleTag.innerHTML = style;
    document.head.appendChild(styleTag);
    const menu = document.querySelector(".comfy-menu");
    const separator = document.createElement("hr");

    separator.style.margin = "20px 0";
    separator.style.width = "100%";
    menu.append(separator);

    const serveButton = document.createElement("button");
    serveButton.textContent = "Serve";
    serveButton.onclick = serveAction;
    menu.append(serveButton);

    const packButton = document.createElement("button");
    packButton.textContent = "Package";
    packButton.onclick = packageAction;
    menu.append(packButton);

    const buildButton = document.createElement("button");
    buildButton.textContent = "Deploy";
    buildButton.onclick = deployAction;
    menu.append(buildButton);


    try {
			// new style Manager buttons

			// unload models button into new style Manager button
			let cmGroup = new (await import("../../scripts/ui/components/buttonGroup.js")).ComfyButtonGroup(
			  new(await import("../../scripts/ui/components/button.js")).ComfyButton({
			    icon: "api",
			    action: serveAction,
			    tooltip: "Comfy-Pack",
			    content: "Serve",
			    classList: "comfyui-button comfyui-menu-mobile-collapse primary"
			  }).element,
				new(await import("../../scripts/ui/components/button.js")).ComfyButton({
					icon: "package-variant-closed",
					action: packageAction,
					tooltip: "Comfy-Pack",
					content: "Package",
					classList: "comfyui-button comfyui-menu-mobile-collapse"
				}).element,
				new(await import("../../scripts/ui/components/button.js")).ComfyButton({
					icon: "cloud-upload",
					action: deployAction,
					tooltip: "Comfy-Pack",
          content: "Deploy",
          classList: "comfyui-button comfyui-menu-mobile-collapse"
        }).element,
      );

			app.menu?.settingsGroup.element.before(cmGroup.element);
		}
		catch(exception) {
			console.log('ComfyUI is outdated. New style menu based features are disabled.');
		}
  }
});
