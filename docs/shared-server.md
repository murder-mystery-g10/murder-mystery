# Shared server

The team server runs the latest version of `main`:

**https://murder-mystery-g10.polandcentral.cloudapp.azure.com**

It is an Azure virtual machine (VM) paid from a limited Azure for Students credit, so it is
**off most of the time**. Start it when you need it; it stops by itself.

Use it to see the common version after a merge, to test together with the team, and for demos.
You don't need it to test your own changes: run the project on your laptop instead (see
[development.md](development.md)).

## Starting and stopping

You need write access to the repository.

1. On GitHub, open the repository and go to **Actions**
2. Pick **Server** in the list on the left, then click **Run workflow** (on the right)
3. Choose `start` (or `stop`) and click the green **Run workflow** button
4. After 1–2 minutes the app is up; open the run to see the link in its summary

From the terminal, with the GitHub CLI, the same thing is:

```bash
gh workflow run server.yml -f action=start
```

### When it stops by itself

The server is deallocated (switched off, so compute costs nothing) at the first of:

- **30 minutes without use**: nobody has the app open and nobody is connected over SSH
- **3 hours after it was started**, even if it is in use. Plan longer sessions around this
  and start it again if needed
- **Night hours, 01:00–07:00** (Romania time). A nightly workflow also stops it at 23:30 UTC
  (01:30 in winter, 02:30 in summer, Romania time)

The first 15 minutes after a start never count as idle.

## Deploys

A **deploy** puts a new version of the app on the server. Every merge into `main` deploys
automatically (**Actions → Deploy**, about 3–4 minutes):

1. GitHub Actions builds the three Docker images (`ai-service`, `backend`, `frontend`) and pushes
   them to GHCR, GitHub's image registry (`ghcr.io/murder-mystery-g10/<service>`)
2. If the server is off, it is started
3. The server pulls the new images and restarts the containers
4. The workflow checks `https://…/api/health/ready` (backend, database and AI service)
5. If the server was off before the deploy, it is stopped again

If a deploy fails, open the run in **Actions → Deploy** to see which step failed (it has a red
cross), then check the container logs (below). The server keeps running the previous images if
the pull fails.

Database migrations run automatically when the backend container starts.

## What GitHub Actions does

GitHub Actions runs **workflows**: scripts in `.github/workflows/` that GitHub starts on certain
events. You see every run under **Actions** on GitHub.

| Workflow | Runs on | Does |
|---|---|---|
| CI (`ci.yml`) | every pull request and every push to `main` | Python lint and tests, frontend lint, tests and build, checks that the generated contracts are up to date, builds the Docker images |
| Deploy (`deploy.yml`) | every push to `main`, tags `v*`, or by hand | Builds and pushes the images, deploys them to the server, checks that it is healthy |
| Server (`server.yml`) | by hand (start/stop), and every night at 23:30 UTC (01:30 in winter, 02:30 in summer, Romania time) to stop it | Starts or stops the server |

Deploy and Server use the GitHub environment `production`, which only `main` and `v*` tags can
use, so a branch can never deploy.

## Logs

Container logs are at **https://murder-mystery-g10.polandcentral.cloudapp.azure.com/logs/**
(user `admin`; ask a server admin for the password). Pick a container on the left to follow its
logs live. Look at `backend` first when something in the game fails.

## Demo versions

For a presentation, freeze a version with a tag on `main`:

```bash
git checkout main && git pull
git tag -a v0.1.0 -m "MVP demo"
git push origin v0.1.0
```

The tag deploys exactly that version. The next merge into `main` replaces it with the latest
`main` again, so avoid merging right before a demo. A server admin also disables the automatic
stops for the day (see [server-admin.md](server-admin.md#demo-and-test-days)).

## Rules

- Don't store anything important only on the server; the database is for testing.
- The server is shared: if you stop it, someone else may be playing on it.
- Don't keep it running when nobody uses it; the credit is limited.
