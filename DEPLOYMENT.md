# Deployment and maintenance

Run these commands from the repository directory with Docker and Docker Compose installed. They use your selected Docker context; no named context or fixed server address is required. Paths passed to Docker bind mounts must exist on the Docker daemon's host. For a remote daemon, copy the source to that host and run the bind-mount examples there, or copy the files into a temporary container with `docker cp`.

## Start and configure

```sh
cp .env.example .env
# Optionally edit .env to choose the host address and port.
docker compose up -d --build --wait
```

Open [http://localhost:8094](http://localhost:8094) on the Docker host, or use its address and your configured port from another machine. The container listens on port 8080; Compose publishes port 8094 by default.

| Setting | Default | Purpose |
| --- | --- | --- |
| `RIVER_BIND_ADDRESS` | `0.0.0.0` | Host interface for the published port. Use `127.0.0.1` for access only from the host. |
| `RIVER_PORT` | `8094` | Published host port. |
| `RIVER_DATA` | `/data` | Storage directory inside the application process. Compose mounts a persistent volume at the default path. |

The first two settings can be set in `.env` or the shell. `RIVER_DATA` is a server environment variable; if you override it, pass it into the container and mount persistent storage at the same path. Local `.env` files and `compose.override.yaml` / `compose.override.yml` files are ignored by Git and excluded from the Docker build context and source archive.

River has no authentication. Anyone who can reach the service can read, edit, and delete saved diagrams. Restrict access to a trusted network, or place an authenticated reverse proxy in front of it. A reverse proxy should preserve the original `Host` header so same-origin write checks work.

The Compose file uses the container name `river-diagram` and volume `river-diagram-data`. Give both unique names if running multiple installations on one Docker host. Keep the data volume when replacing containers; `docker compose down` preserves it. `docker compose down -v` deletes saved diagrams.

## Update and inspect

```sh
docker compose up -d --build --wait
docker compose ps
docker compose logs --tail 80 river
docker compose exec river /river healthcheck
docker compose stats --no-stream river
```

## Back up data

Saved rivers are individual JSON documents in the Docker volume. Stop writes while creating a consistent backup:

```sh
mkdir -p backups
docker compose stop river
docker run --rm -v river-diagram-data:/data:ro busybox:1.37 \
  tar -czf - -C /data . > backups/river-data-backup.tar.gz
docker compose start river
```

Retain the current data before restoring. Stop the service, restore a verified backup into the data volume using a helper container, and start the service again. Keep backups private; they contain saved diagrams.

## Source distribution

Generate the optional source download before building:

```sh
sh scripts/package-source.sh
docker compose up -d --build --wait
```

The app then serves the archive at `/river-source.tar.gz`. A checkout builds and runs without it. Packaging uses an explicit list of source, documentation, license, example configuration, and test files. It excludes Git history, local settings, saved diagrams, backups, dependencies, and generated test reports or screenshots. Refresh the archive after changing source files so the download matches the build.

## Go tests

Use the same build image as the application:

```sh
docker run --rm -v "$PWD:/work:ro" -w /work \
  golang:alpine@sha256:70bd7ddea8b6cbe5d6943cde279d6b67feb10cc924fb9100d1d8757c1575b280 \
  go test -v ./...
```

With Go 1.25 or newer already installed, `go test ./...` also works. The application has no third-party Go modules.

## Browser tests

The scripts share `qa/config.cjs` and use these settings:

| Setting | Default | Purpose |
| --- | --- | --- |
| `BASE_URL` | `http://localhost:8094` | River instance to test, as reachable from the test runner. |
| `QA_OUTPUT_DIR` | `qa/artifacts` beside the test scripts | Generated reports, screenshots, and exports. A relative override is resolved from the runner's working directory. |
| `PREVIEW` | unset | Set to `1` to serve checkout assets in the layout, gate, and river-detail tests. |

Tests resolve `playwright` and `axe-core` through normal Node module resolution, including `NODE_PATH`. The following example installs them only inside a disposable container, which shares the running app container's network namespace and reaches it over loopback:

```sh
docker run -d --init --name river-diagram-qa --shm-size=1g \
  --network container:river-diagram \
  -e BASE_URL=http://127.0.0.1:8080 \
  -e NODE_PATH=/tmp/river-qa/node_modules \
  -v "$PWD:/work" -w /work \
  mcr.microsoft.com/playwright:v1.56.1-noble sleep infinity
docker exec river-diagram-qa npm install --prefix /tmp/river-qa \
  --no-audit --no-fund playwright@1.56.1 axe-core@4.10.3
docker exec river-diagram-qa node qa/e2e.cjs
docker exec river-diagram-qa node qa/layout.cjs
docker exec river-diagram-qa node qa/inspect.cjs
docker exec river-diagram-qa node qa/accessibility.cjs
docker exec river-diagram-qa node qa/gates.cjs
docker exec river-diagram-qa node qa/river-detail.cjs
docker exec river-diagram-qa node qa/count-label.cjs
docker rm -f river-diagram-qa
```

Use a disposable River instance for testing. The save workflows create uniquely named `qa-river-*` and `qa-count-label-*` documents and delete those documents during cleanup. Some accessibility checks bypass CSP only in the test browser context so axe can be injected; the app's CSP remains intact. `inspect.cjs` produces screenshots and diagnostics for manual review; the other scripts assert their checks.

Remove only the test containers and artifacts you created when finished. Keep the application data volume.
