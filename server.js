const express = require('express');
const cors = require('cors');
const axios = require('axios');
const dotenv = require('dotenv');
const { OpenAI } = require('openai');

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// OpenAI Configuration
if (!process.env.OPENAI_API_KEY) {
    console.warn('WARNING: OPENAI_API_KEY is missing from environment variables.');
}

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || 'missing',
});

/**
 * Helper to fetch content of a specific file from GitHub
 */
async function fetchFileContent(owner, repo, path) {
    try {
        const response = await axios.get(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`);
        const content = Buffer.from(response.data.content, 'base64').toString('utf-8');
        return content;
    } catch (error) {
        console.error(`Error fetching file ${path}:`, error.message);
        return null;
    }
}

/**
 * Helper to get a list of code files from a GitHub repo
 */
async function getRepoFiles(owner, repo) {
    try {
        const url = `https://api.github.com/repos/${owner}/${repo}/git/trees/main?recursive=1`;
        // Try 'main' then 'master'
        let response;
        try {
            response = await axios.get(url);
        } catch (e) {
            response = await axios.get(`https://api.github.com/repos/${owner}/${repo}/git/trees/master?recursive=1`);
        }

        const tree = response.data.tree;
        // Filter for common code extensions and limit to first 10 files to avoid token limits
        const allowedExtensions = ['.js', '.py', '.java', '.ts', '.go', '.cpp'];
        const files = tree
            .filter(file => file.type === 'blob' && allowedExtensions.some(ext => file.path.endsWith(ext)))
            .slice(0, 10);

        return files;
    } catch (error) {
        console.error('Error fetching repo tree:', error.message);
        throw new Error('Could not fetch repository structure. Ensure the URL is correct and public.');
    }
}

// POST endpoint to generate documentation
app.post('/generate-docs', async (req, res) => {
    const { repo_url, code } = req.body;

    try {
        let contentToAnalyze = "";

        if (repo_url) {
            // Parse owner/repo from URL
            const urlParts = repo_url.replace('https://github.com/', '').split('/');
            if (urlParts.length < 2) {
                return res.status(400).json({ error: 'Invalid GitHub URL' });
            }
            const owner = urlParts[0];
            const repo = urlParts[1];

            const files = await getRepoFiles(owner, repo);
            const fileContents = await Promise.all(
                files.map(async (file) => {
                    const content = await fetchFileContent(owner, repo, file.path);
                    return `--- File: ${file.path} ---\n${content}\n`;
                })
            );
            contentToAnalyze = fileContents.join('\n');
        } else if (code) {
            contentToAnalyze = code;
        } else {
            return res.status(400).json({ error: 'No repository URL or code snippet provided' });
        }

        if (!contentToAnalyze) {
            return res.status(400).json({ error: 'No valid code found to analyze' });
        }

        // AI Prompt
        const prompt = `
        Analyze the following code and generate technical documentation in JSON format.
        Return ONLY a JSON object with this exact structure:
        {
          "project_description": "A concise overview of what the project does.",
          "functions": [
            { "name": "functionName", "description": "What it does" }
          ],
          "api_endpoints": [
            { "method": "GET/POST", "path": "/example", "description": "What it does" }
          ],
          "usage": "Provide a simple example of how to run or use this code."
        }

        If information is not available for a specific field, return an empty array or an appropriate placeholder string.
        
        CODE TO ANALYZE:
        ${contentToAnalyze.substring(0, 15000)} // Limiting size for token limits
        `;

        if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'missing') {
            return res.status(500).json({ 
                error: 'OpenAI API key is not configured. Please add it to your .env file.' 
            });
        }

        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" }
        });

        const result = JSON.parse(response.choices[0].message.content);
        res.json(result);

    } catch (error) {
        console.error('Error generating docs:', error.message);
        res.status(500).json({ error: error.message || 'An error occurred during generation' });
    }
});

app.listen(port, () => {
    console.log(`AutoDoc AI server running at http://localhost:${port}`);
});
