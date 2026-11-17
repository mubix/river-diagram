FROM golang:alpine@sha256:70bd7ddea8b6cbe5d6943cde279d6b67feb10cc924fb9100d1d8757c1575b280 AS build
WORKDIR /src
COPY go.mod main.go ./
COPY web ./web
RUN CGO_ENABLED=0 go build -trimpath -ldflags='-s -w' -o /river .
FROM scratch
COPY --from=build /river /river
COPY LICENSE /LICENSE
VOLUME /data
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s CMD ["/river", "healthcheck"]
ENTRYPOINT ["/river"]
