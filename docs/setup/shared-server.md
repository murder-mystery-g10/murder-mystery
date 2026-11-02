# Shared server

The team server runs the latest version of `main`:

**https://murder-mystery-g10.polandcentral.cloudapp.azure.com**

It is an Azure VM paid from a limited student credit, so it is **off most of the time**. Start it
when you need it; it stops by itself.

## Starting and stopping

You need write access to the repository.

1. Go to **Actions → Server → Run workflow**
2. Choose `start` (or `stop`) and click **Run workflow**
3. After 1–2 minutes the app is up; the run summary shows the link

From the terminal: `gh workflow run server.yml -f action=start`

### When it stops by itself

The server is deallocated (no cost for compute) at the first of:

- **30 minutes without use**: nobody has the app open and nobody is connected over SSH
- **3 hours after it was started**, even if it is in use. Plan longer sessions around this
  and start it again if needed
- **Night hours, 01:00–07:00** (Romania time). A nightly workflow also stops it at 01:30

The first 15 minutes after a start never count as idle.

## Deploys

Every merge into `main` deploys automatically (**Actions → Deploy**, about 3–4 minutes):

1. GitHub Actions builds the three images (`ai-service`, `backend`, `frontend`) and pushes them to
   GHCR (`ghcr.io/murder-mystery-g10/<service>`)
2. If the server is off, it is started
3. The server pulls the new images and restarts the containers
4. The workflow checks `https://…/api/health/ready` (backend, database and AI service)
5. If the server was off before the deploy, it is stopped again

If a deploy fails, open the run in **Actions → Deploy** to see which step failed, then check
the container logs (below). The server keeps running the previous images if the pull fails.

Database migrations run automatically when the backend container starts.

## Logs

Container logs are at **https://murder-mystery-g10.polandcentral.cloudapp.azure.com/logs/**
(user `admin`; ask a server admin for the password). Pick a container on the left to follow its
logs live.

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
