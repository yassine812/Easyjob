# FreeHire remains a separate MIT-licensed service. Its source is pinned by scripts/freehire.cjs.
FROM golang:1.26-alpine AS build
ENV GOMAXPROCS=2 GOMEMLIMIT=256MiB GOFLAGS=-p=2
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -ldflags="-s -w" -o /out/ ./cmd/server ./cmd/ingest ./cmd/migrate ./cmd/add-board

FROM alpine:3.22
RUN apk add --no-cache ca-certificates && adduser -D -u 65532 collector
WORKDIR /app
COPY --from=build /out/ /app/
COPY --from=build /src/migrations /app/migrations
COPY --from=build /src/LICENSE /app/FREEHIRE-LICENSE
USER collector
ENTRYPOINT ["/app/server"]
