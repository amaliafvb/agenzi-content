# AGENZI Studio — Internal Content OS

Internal-only social media operations workspace for AGENZI Digital Mandiri.

## Current scope
- Premium light UI: ivory, white and orange
- Internal roles: Admin, Strategist, Copywriter, Designer
- Client assignment per division
- Content calendar and client-specific PDF export
- Content database: caption/copy, Canva, Drive, approval, PIC and deadlines
- Team tasks and activity log
- Performance input and WORK / NOT WORK learning
- Supabase production schema foundation
- Dockerfile + Nginx + Docker Compose
- GitHub Actions workflow for publishing a Docker image to Docker Hub

## Docker

Build locally:

\`\`\`bash
docker build -t agenzi-content .
docker run --rm -p 8080:80 agenzi-content
\`\`\`

Open \`http://localhost:8080\`.

Or with Compose:

\`\`\`bash
docker compose up --build
\`\`\`

The GitHub Actions workflow builds the image on pushes to \`main\` and pushes it to Docker Hub after Docker Hub credentials are configured in the GitHub repository. Docker provides official GitHub Actions for Docker login, build and push. 

Required GitHub repository configuration:
- Variable: \`DOCKERHUB_USERNAME\`
- Secret: \`DOCKERHUB_TOKEN\`

Create the Docker Hub repository first, then add a Docker Hub access token to the GitHub secret. Never put the token in source files.

## Prototype note

This GitHub version is still a frontend prototype. Credentials and content are stored in browser localStorage for demonstration. Do not use real passwords in this prototype.

## Production next step

Connect Supabase Auth + PostgreSQL + RLS + Realtime, then deploy the frontend/container. Never store real passwords, service-role keys or secrets in this repository.
