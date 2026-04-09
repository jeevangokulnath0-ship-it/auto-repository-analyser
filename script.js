document.addEventListener('DOMContentLoaded', () => {
    const generateBtn = document.getElementById('generate-btn');
    const repoUrlInput = document.getElementById('repo-url');
    const codeSnippetInput = document.getElementById('code-snippet');
    const resultsSection = document.getElementById('results');
    const loader = document.getElementById('loader');
    const btnText = document.getElementById('btn-text');
    const errorBox = document.getElementById('error-box');
    const copyBtn = document.getElementById('copy-btn');

    // Result elements
    const projectDesc = document.getElementById('project-description');
    const functionsList = document.getElementById('functions-list');
    const apiEndpoints = document.getElementById('api-endpoints');
    const usageContent = document.getElementById('usage-content');

    const API_URL = 'http://localhost:5000/generate-docs';

    generateBtn.addEventListener('click', async () => {
        const repoUrl = repoUrlInput.value.trim();
        const codeSnippet = codeSnippetInput.value.trim();

        if (!repoUrl && !codeSnippet) {
            showError('Please provide either a GitHub URL or a code snippet.');
            return;
        }

        // Reset UI
        hideError();
        setLoading(true);
        resultsSection.style.display = 'none';

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    repo_url: repoUrl,
                    code: codeSnippet
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to generate documentation');
            }

            displayResults(data);
        } catch (err) {
            showError(err.message);
        } finally {
            setLoading(false);
        }
    });

    copyBtn.addEventListener('click', () => {
        const fullDoc = `
# Project Overview
${projectDesc.textContent}

# Functions & Classes
${functionsList.innerText}

# API Endpoints
${apiEndpoints.innerText}

# Example Usage
${usageContent.innerText}
        `.trim();

        navigator.clipboard.writeText(fullDoc).then(() => {
            const originalText = copyBtn.textContent;
            copyBtn.textContent = 'Copied!';
            setTimeout(() => {
                copyBtn.textContent = originalText;
            }, 2000);
        });
    });

    function displayResults(data) {
        // 1. Project Description
        projectDesc.textContent = data.project_description || 'No description available.';

        // 2. Functions
        functionsList.innerHTML = '';
        if (data.functions && data.functions.length > 0) {
            const list = document.createElement('ul');
            list.style.listStyle = 'none';
            data.functions.forEach(fn => {
                const li = document.createElement('li');
                li.style.marginBottom = '1rem';
                li.innerHTML = `<strong><code>${fn.name}</code></strong>: ${fn.description}`;
                list.appendChild(li);
            });
            functionsList.appendChild(list);
        } else {
            functionsList.textContent = 'No functions detected.';
        }

        // 3. API Endpoints
        apiEndpoints.innerHTML = '';
        if (data.api_endpoints && data.api_endpoints.length > 0) {
            const list = document.createElement('ul');
            list.style.listStyle = 'none';
            data.api_endpoints.forEach(api => {
                const li = document.createElement('li');
                li.style.marginBottom = '1rem';
                li.innerHTML = `<span class="tag">${api.method}</span> <code>${api.path}</code> - ${api.description}`;
                list.appendChild(li);
            });
            apiEndpoints.appendChild(list);
        } else {
            apiEndpoints.textContent = 'No API endpoints detected.';
        }

        // 4. Usage
        usageContent.innerHTML = `<pre><code>${data.usage || 'No usage examples provided.'}</code></pre>`;

        // Show Section
        resultsSection.style.display = 'block';
        resultsSection.scrollIntoView({ behavior: 'smooth' });
    }

    function setLoading(isLoading) {
        if (isLoading) {
            generateBtn.disabled = true;
            loader.style.display = 'inline-block';
            btnText.textContent = 'Generating...';
        } else {
            generateBtn.disabled = false;
            loader.style.display = 'none';
            btnText.textContent = 'Generate Documentation';
        }
    }

    function showError(message) {
        errorBox.textContent = message;
        errorBox.style.display = 'block';
    }

    function hideError() {
        errorBox.style.display = 'none';
    }
});
