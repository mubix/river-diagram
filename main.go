package main

import (
	"bytes"
	"embed"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"log"
	"math"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
)

//go:embed web/*
var assets embed.FS

var slugPattern = regexp.MustCompile(`^[a-z0-9]+(?:-[a-z0-9]+)*$`)
var colorPattern = regexp.MustCompile(`^#[0-9a-fA-F]{6}$`)

type Palette struct {
	River   string `json:"river"`
	Control string `json:"control"`
	Accent  string `json:"accent"`
}
type Control struct {
	ID           string  `json:"id"`
	Name         string  `json:"name"`
	Remaining    float64 `json:"remaining"`
	Label        string  `json:"label"`
	RiverColor   string  `json:"riverColor"`
	ControlColor string  `json:"controlColor"`
}
type River struct {
	CountLabel  string    `json:"countLabel"`
	ShowPercent bool      `json:"showPercent"`
	Slug        string    `json:"slug"`
	Title       string    `json:"title"`
	Subtitle    string    `json:"subtitle"`
	SourceLabel string    `json:"sourceLabel"`
	SourceValue float64   `json:"sourceValue"`
	SourceColor string    `json:"sourceColor"`
	Note        string    `json:"note"`
	Scale       string    `json:"scale"`
	Style       string    `json:"style"`
	Background  string    `json:"background"`
	Palette     Palette   `json:"palette"`
	Controls    []Control `json:"controls"`
	Revision    int       `json:"revision"`
	UpdatedAt   string    `json:"updatedAt"`
}
type server struct {
	dir string
	mu  sync.Mutex
}

func validCount(v float64) bool {
	return !math.IsNaN(v) && !math.IsInf(v, 0) && v >= 0 && v <= 9007199254740991 && math.Trunc(v) == v
}
func normalizedCountLabel(s string) string {
	s = strings.Join(strings.Fields(s), " ")
	if s == "" {
		return "blocked"
	}
	return s
}

func validate(r River) error {
	if len([]rune(r.CountLabel)) > 24 {
		return errors.New("The count label must be 24 characters or fewer.")
	}
	if !slugPattern.MatchString(r.Slug) || len(r.Slug) > 80 {
		return errors.New("Use a URL name of 1–80 lowercase letters, numbers, and single hyphens.")
	}
	if strings.TrimSpace(r.Title) == "" || len([]rune(r.Title)) > 100 {
		return errors.New("Give your river a title of 1–100 characters.")
	}
	if len([]rune(r.Subtitle)) > 180 || len([]rune(r.SourceLabel)) > 100 || strings.TrimSpace(r.SourceLabel) == "" || len([]rune(r.Note)) > 300 {
		return errors.New("Check the source label, subtitle, or note length.")
	}
	if !validCount(r.SourceValue) || r.SourceValue == 0 {
		return errors.New("The starting quantity must be a positive whole number.")
	}
	if r.Scale != "exact" && r.Scale != "presentation" {
		return errors.New("Choose exact or presentation scale.")
	}
	if r.Style != "diversion" && r.Style != "gate" {
		return errors.New("Choose a supported control style.")
	}
	for _, c := range []string{r.SourceColor, r.Background, r.Palette.River, r.Palette.Control, r.Palette.Accent} {
		if !colorPattern.MatchString(c) {
			return errors.New("Colors must use six-digit hex values.")
		}
	}
	if len(r.Controls) > 48 {
		return errors.New("A river can contain up to 48 controls; split larger models into linked rivers.")
	}
	prev := r.SourceValue
	seen := map[string]bool{}
	for _, c := range r.Controls {
		if len(c.ID) < 1 || len(c.ID) > 80 || seen[c.ID] {
			return errors.New("Each control needs a unique ID.")
		}
		seen[c.ID] = true
		if strings.TrimSpace(c.Name) == "" || len([]rune(c.Name)) > 80 || len([]rune(c.Label)) > 100 {
			return errors.New("Each control needs a name of up to 80 characters and a label of up to 100 characters.")
		}
		if !validCount(c.Remaining) || c.Remaining > prev {
			return fmt.Errorf("%s: remaining quantity must be between 0 and %s.", c.Name, strconv.FormatFloat(prev, 'f', 0, 64))
		}
		prev = c.Remaining
		if !colorPattern.MatchString(c.RiverColor) || !colorPattern.MatchString(c.ControlColor) {
			return errors.New("Each control and river segment needs a valid color.")
		}
	}
	return nil
}
func respond(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}
func fail(w http.ResponseWriter, status int, msg string) {
	respond(w, status, map[string]string{"error": msg})
}
func (s *server) read(slug string) (River, error) {
	var r River
	r.ShowPercent = true
	b, e := os.ReadFile(filepath.Join(s.dir, slug+".json"))
	if e != nil {
		return r, e
	}
	e = json.Unmarshal(b, &r)
	r.CountLabel = normalizedCountLabel(r.CountLabel)
	return r, e
}
func (s *server) write(r River) error {
	b, e := json.MarshalIndent(r, "", "  ")
	if e != nil {
		return e
	}
	f, e := os.CreateTemp(s.dir, ".river-*")
	if e != nil {
		return e
	}
	name := f.Name()
	defer os.Remove(name)
	if _, e = f.Write(b); e != nil {
		f.Close()
		return e
	}
	if e = f.Sync(); e != nil {
		f.Close()
		return e
	}
	if e = f.Close(); e != nil {
		return e
	}
	if e = os.Rename(name, filepath.Join(s.dir, r.Slug+".json")); e != nil {
		return e
	}
	d, e := os.Open(s.dir)
	if e != nil {
		return e
	}
	defer d.Close()
	return d.Sync()
}
func (s *server) api(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	if r.Method != "GET" && r.Method != "HEAD" {
		if origin := r.Header.Get("Origin"); origin != "" && origin != "http://"+r.Host && origin != "https://"+r.Host {
			fail(w, 403, "Save from this application's own page.")
			return
		}
		if r.Header.Get("Sec-Fetch-Site") == "cross-site" {
			fail(w, 403, "Cross-site changes are not allowed.")
			return
		}
	}
	slug := strings.TrimPrefix(r.URL.Path, "/api/rivers")
	if slug != "" {
		if !strings.HasPrefix(slug, "/") {
			http.NotFound(w, r)
			return
		}
		slug = strings.TrimPrefix(slug, "/")
		if !slugPattern.MatchString(slug) || len(slug) > 80 {
			fail(w, 404, "River not found.")
			return
		}
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if r.Method == "GET" {
		if slug == "" {
			entries, e := os.ReadDir(s.dir)
			if e != nil {
				fail(w, 500, "Could not read the river library.")
				return
			}
			list := []River{}
			for _, entry := range entries {
				if !entry.IsDir() && strings.HasSuffix(entry.Name(), ".json") {
					v, e := s.read(strings.TrimSuffix(entry.Name(), ".json"))
					if e != nil {
						log.Printf("read river %q: %v", entry.Name(), e)
						fail(w, 500, "A saved river could not be read. Check server logs.")
						return
					}
					list = append(list, v)
				}
			}
			sort.Slice(list, func(i, j int) bool { return list[i].UpdatedAt > list[j].UpdatedAt })
			respond(w, 200, list)
			return
		}
		v, e := s.read(slug)
		if os.IsNotExist(e) {
			fail(w, 404, "This river does not exist.")
			return
		}
		if e != nil {
			fail(w, 500, "Could not read this river.")
			return
		}
		respond(w, 200, v)
		return
	}
	if r.Method == "DELETE" && slug != "" {
		v, e := s.read(slug)
		if os.IsNotExist(e) {
			fail(w, 404, "This river does not exist.")
			return
		}
		if e != nil {
			fail(w, 500, "Could not read this river.")
			return
		}
		if r.Header.Get("If-Match") != strconv.Itoa(v.Revision) {
			fail(w, 409, "This river changed elsewhere. Refresh the library before deleting.")
			return
		}
		if e = os.Remove(filepath.Join(s.dir, slug+".json")); e != nil {
			fail(w, 500, "Could not delete this river.")
			return
		}
		w.WriteHeader(204)
		return
	}
	if (r.Method != "POST" || slug != "") && (r.Method != "PUT" || slug == "") {
		w.Header().Set("Allow", "GET, POST, PUT, DELETE")
		fail(w, 405, "Method not allowed.")
		return
	}
	if !strings.HasPrefix(r.Header.Get("Content-Type"), "application/json") {
		fail(w, 415, "Send a JSON river.")
		return
	}
	var v River
	v.ShowPercent = true
	d := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1024*1024))
	d.DisallowUnknownFields()
	if e := d.Decode(&v); e != nil {
		fail(w, 400, "The river file is invalid or too large.")
		return
	}
	if e := d.Decode(new(any)); e != io.EOF {
		fail(w, 400, "Send a single river document.")
		return
	}
	if slug != "" && slug != v.Slug {
		fail(w, 400, "The saved URL cannot be changed. Save a copy with a new name.")
		return
	}
	if v.Controls == nil {
		v.Controls = []Control{}
	}
	v.CountLabel = normalizedCountLabel(v.CountLabel)
	if e := validate(v); e != nil {
		fail(w, 422, e.Error())
		return
	}
	old, e := s.read(v.Slug)
	if e != nil && !os.IsNotExist(e) {
		fail(w, 500, "Could not read the existing river.")
		return
	}
	status := 200
	if r.Method == "POST" {
		if e == nil {
			fail(w, 409, "That URL is already in use. Choose another name.")
			return
		}
		v.Revision = 1
		status = 201
	} else {
		if os.IsNotExist(e) {
			fail(w, 404, "This river was removed. Save a copy to keep your changes.")
			return
		}
		if v.Revision != old.Revision {
			fail(w, 409, "This river changed in another tab. Save a copy to keep your edits, or reload to get the latest version.")
			return
		}
		v.Revision = old.Revision + 1
	}
	v.UpdatedAt = time.Now().UTC().Format(time.RFC3339Nano)
	if e := s.write(v); e != nil {
		log.Printf("save river: %v", e)
		fail(w, 500, "Could not save. Your changes remain in this browser.")
		return
	}
	respond(w, status, v)
}
func handler(dir string) http.Handler {
	s := &server{dir: dir}
	mux := http.NewServeMux()
	mux.HandleFunc("/api/rivers", s.api)
	mux.HandleFunc("/api/rivers/", s.api)
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain")
		io.WriteString(w, "ok\n")
	})
	static, _ := fs.Sub(assets, "web")
	files := http.FileServer(http.FS(static))
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "GET" && r.Method != "HEAD" {
			w.WriteHeader(405)
			return
		}
		if r.URL.Path == "/" || r.URL.Path == "/compare" || strings.HasPrefix(r.URL.Path, "/r/") {
			b, _ := assets.ReadFile("web/index.html")
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			w.Header().Set("Cache-Control", "no-cache")
			http.ServeContent(w, r, "index.html", time.Time{}, bytes.NewReader(b))
			return
		}
		files.ServeHTTP(w, r)
	})
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Referrer-Policy", "same-origin")
		w.Header().Set("X-Frame-Options", "SAMEORIGIN")
		w.Header().Set("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'self'; form-action 'self'")
		mux.ServeHTTP(w, r)
	})
}
func main() {
	if len(os.Args) > 1 && os.Args[1] == "healthcheck" {
		c := http.Client{Timeout: 2 * time.Second}
		r, e := c.Get("http://127.0.0.1:8080/healthz")
		if e != nil || r.StatusCode != 200 {
			os.Exit(1)
		}
		r.Body.Close()
		return
	}
	dir := os.Getenv("RIVER_DATA")
	if dir == "" {
		dir = "/data"
	}
	if e := os.MkdirAll(dir, 0700); e != nil {
		log.Fatal(e)
	}
	log.Print("River listening on :8080")
	srv := http.Server{Addr: ":8080", Handler: handler(dir), ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 15 * time.Second, WriteTimeout: 30 * time.Second, IdleTimeout: 60 * time.Second, MaxHeaderBytes: 16384}
	log.Fatal(srv.ListenAndServe())
}
