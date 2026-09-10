---
name: docker-expert
description: 'Use when changing or reviewing Dockerfiles, Docker Compose files, image builds, container security, networking, or runtime container behavior.'
metadata:
  version: '4.1.0-fractal'
  category: 'devops'
  color: 'blue'
  displayName: 'Docker Expert'
---

# Docker Expert

Docker containerization guidance for build files, image hygiene, Compose orchestration, runtime diagnostics, and deployment-adjacent container issues.

## When invoked:

0. If the issue is outside Docker, state the boundary and route to an available local skill/profile. Do not invent or require unavailable subagents.

1. Analyze container setup comprehensively:

   Use available local file and shell tools. Prefer repository files over generic examples.

   ```bash
   # Docker environment detection
   docker --version 2>/dev/null || echo "No Docker installed"
   docker info | grep -E "Server Version|Storage Driver|Container Runtime" 2>/dev/null
   docker context ls 2>/dev/null | head -3

   # Project structure analysis
   find . -name "Dockerfile*" -type f | head -10
   find . -name "*compose*.yml" -o -name "*compose*.yaml" -type f | head -5
   find . -name ".dockerignore" -type f | head -3

   # Container status if running
   docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}" 2>/dev/null | head -10
   docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}" 2>/dev/null | head -10
   ```

   **After detection, adapt approach:**
   - Match existing Dockerfile patterns and base images
   - Respect multi-stage build conventions
   - Consider development vs production environments
   - Account for existing orchestration setup (Compose/Swarm)

2. Identify the specific problem category and complexity level.

3. Apply the appropriate solution strategy from the relevant reference.

4. Validate thoroughly:

   ```bash
   # Build and security validation
   docker build --no-cache -t test-build . 2>/dev/null && echo "Build successful"
   docker history test-build --no-trunc 2>/dev/null | head -5
   docker scout quickview test-build 2>/dev/null || echo "No Docker Scout"

   # Runtime validation
   docker run --rm -d --name validation-test test-build 2>/dev/null
   docker exec validation-test ps aux 2>/dev/null | head -3
   docker stop validation-test 2>/dev/null

   # Compose validation
   docker-compose config 2>/dev/null && echo "Compose config valid"
   ```

## Core Expertise Areas

## 🧠 Knowledge Modules (Fractal Skills)

### 1. [1. Dockerfile Optimization & Multi-Stage Builds](./sub-skills/1-dockerfile-optimization-multi-stage-builds.md)

### 2. [2. Container Security Hardening](./sub-skills/2-container-security-hardening.md)

### 3. [3. Docker Compose Orchestration](./sub-skills/3-docker-compose-orchestration.md)

### 4. [4. Image Size Optimization](./sub-skills/4-image-size-optimization.md)

### 5. [5. Development Workflow Integration](./sub-skills/5-development-workflow-integration.md)

### 6. [6. Performance & Resource Management](./sub-skills/6-performance-resource-management.md)

### 7. [Cross-Platform Builds](./sub-skills/cross-platform-builds.md)

### 8. [Build Cache Optimization](./sub-skills/build-cache-optimization.md)

### 9. [Secrets Management](./sub-skills/secrets-management.md)

### 10. [Health Check Strategies](./sub-skills/health-check-strategies.md)

### 11. [Dockerfile Optimization & Multi-Stage Builds](./sub-skills/dockerfile-optimization-multi-stage-builds.md)

### 12. [Container Security Hardening](./sub-skills/container-security-hardening.md)

### 13. [Docker Compose & Orchestration](./sub-skills/docker-compose-orchestration.md)

### 14. [Image Size & Performance](./sub-skills/image-size-performance.md)

### 15. [Development Workflow Integration](./sub-skills/development-workflow-integration.md)

### 16. [Networking & Service Discovery](./sub-skills/networking-service-discovery.md)

### 17. [Build Performance Issues](./sub-skills/build-performance-issues.md)

### 18. [Security Vulnerabilities](./sub-skills/security-vulnerabilities.md)

### 19. [Image Size Problems](./sub-skills/image-size-problems.md)

### 20. [Networking Issues](./sub-skills/networking-issues.md)

### 21. [Development Workflow Problems](./sub-skills/development-workflow-problems.md)
