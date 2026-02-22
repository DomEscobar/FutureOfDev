# CEO & PM Suggestions
This file contains instructions and ideas added via Telegram for the agency to process.

- [2026-02-21T21:31:19.528Z] System reset performed.

- [2026-02-21T21:42:03.972Z] Redesign the Commander Dashboard and Navbar for Mobile perfection. Simplicity but great UI and UX
- [2026-02-21T22:13:43.910Z] finalize league view and features- [2026-02-21T22:38:46Z] finalize the league feature on all edges and add 1 league

- [2026-02-21T22:40:24.979Z] top navbar is obsolete display the others on a a expanded bottom Nav somehow
- [2026-02-22T13:38:33.414Z] overhaul roaster. Mobile perfection and feature completed
- [2026-02-22T15:13:57.229Z] fix the build out: #*** ERROR: process "/bin/sh -c CGO_ENABLED=0 GOOS=linux go build -o /api ./cmd/api" did not complete successfully: exit code: 1 
out: #23 [frontend-prod builder 4/6] RUN npm ci 
out: #23 CANCELED 
out: ------ 
out: > [backend-prod builder 6/6] RUN CGO_ENABLED=0 GOOS=linux go build -o /api ./cmd/api: 
out: 9.627 # empoweredpixels/internal/usecase/leagues 
out: 9.627 internal/usecase/leagues/interfaces.go:31:76: undefined: time 
out: ------ 
err: Dockerfile:8 
err: -------------------- 
err: 6 | 
err: 7 | COPY . . 
err: 8 | >>> RUN CGO_ENABLED=0 GOOS=linux go build -o /api ./cmd/api 
err: 9 | 
err: 10 | FROM alpine:3.19 
err: -------------------- 
err: target backend-prod: failed to solve: process "/bin/sh -c CGO_ENABLED=0 GOOS=linux go build -o /api ./cmd/api" did not complete successfully: exit code: 1 
2026/02/*** 14:39:13 Process exited with status
- [2026-02-22T15:13:57.411Z] fix the build out: #*** ERROR: process "/bin/sh -c CGO_ENABLED=0 GOOS=linux go build -o /api ./cmd/api" did not complete successfully: exit code: 1 
out: #23 [frontend-prod builder 4/6] RUN npm ci 
out: #23 CANCELED 
out: ------ 
out: > [backend-prod builder 6/6] RUN CGO_ENABLED=0 GOOS=linux go build -o /api ./cmd/api: 
out: 9.627 # empoweredpixels/internal/usecase/leagues 
out: 9.627 internal/usecase/leagues/interfaces.go:31:76: undefined: time 
out: ------ 
err: Dockerfile:8 
err: -------------------- 
err: 6 | 
err: 7 | COPY . . 
err: 8 | >>> RUN CGO_ENABLED=0 GOOS=linux go build -o /api ./cmd/api 
err: 9 | 
err: 10 | FROM alpine:3.19 
err: -------------------- 
err: target backend-prod: failed to solve: process "/bin/sh -c CGO_ENABLED=0 GOOS=linux go build -o /api ./cmd/api" did not complete successfully: exit code: 1 
2026/02/*** 14:39:13 Process exited with status
- [2026-02-22T16:51:46.957Z] roster view has error on equiping armor. Also the armor images are all the same they should be individual
- [2026-02-22T17:55:55.356Z] [PLANNED] purge  this views rankings, shop, attunments completly