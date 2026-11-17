package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
)

func fixture() River {
	return River{Slug: "email-defense", Title: "Email defense", SourceLabel: "emails", SourceValue: 4000000, SourceColor: "#215e91", Scale: "exact", Style: "diversion", Background: "#ffffff", Palette: Palette{"#215e91", "#4d9eaa", "#16384f"}, Controls: []Control{{"one", "Spam", 2000000, "emails", "#215e91", "#4d9eaa"}, {"two", "Response", 4, "phishing emails", "#215e91", "#4d9eaa"}, {"three", "Endpoint", 0, "incidents", "#215e91", "#4d9eaa"}}}
}
func request(h http.Handler, method, path string, body any) *httptest.ResponseRecorder {
	var b bytes.Buffer
	if body != nil {
		json.NewEncoder(&b).Encode(body)
	}
	r := httptest.NewRequest(method, path, &b)
	r.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	return w
}
func decode(t *testing.T, w *httptest.ResponseRecorder) River {
	t.Helper()
	var v River
	if e := json.Unmarshal(w.Body.Bytes(), &v); e != nil {
		t.Fatal(e)
	}
	return v
}
func TestPersistenceAndLifecycle(t *testing.T) {
	dir := t.TempDir()
	h := handler(dir)
	r := fixture()
	w := request(h, "POST", "/api/rivers", r)
	if w.Code != 201 {
		t.Fatal(w.Code, w.Body)
	}
	r = decode(t, w)
	if r.Revision != 1 || r.UpdatedAt == "" {
		t.Fatal(r)
	}
	h = handler(dir)
	w = request(h, "GET", "/api/rivers/email-defense", nil)
	if w.Code != 200 || decode(t, w).Controls[1].Remaining != 4 {
		t.Fatal(w.Body)
	}
	r.Title = "Changed"
	w = request(h, "PUT", "/api/rivers/email-defense", r)
	if w.Code != 200 || decode(t, w).Revision != 2 {
		t.Fatal(w.Code, w.Body)
	}
	if w = request(h, "POST", "/api/rivers", r); w.Code != 409 {
		t.Fatal("duplicate", w.Code)
	}
	if w = request(h, "PUT", "/api/rivers/email-defense", r); w.Code != 409 {
		t.Fatal("stale", w.Code)
	}
	w = request(h, "GET", "/api/rivers", nil)
	if w.Code != 200 || !strings.Contains(w.Body.String(), "Changed") {
		t.Fatal(w.Body)
	}
	req := httptest.NewRequest("DELETE", "/api/rivers/email-defense", nil)
	req.Header.Set("If-Match", "2")
	w = httptest.NewRecorder()
	h.ServeHTTP(w, req)
	if w.Code != 204 {
		t.Fatal(w.Code)
	}
	if request(h, "GET", "/api/rivers/email-defense", nil).Code != 404 {
		t.Fatal("delete failed")
	}
}
func TestInvalidRivers(t *testing.T) {
	cases := []struct {
		name   string
		change func(*River)
	}{{"increasing", func(r *River) { r.Controls[1].Remaining = 3000000 }}, {"negative", func(r *River) { r.Controls[0].Remaining = -1 }}, {"fraction", func(r *River) { r.Controls[0].Remaining = 1.2 }}, {"unsafe integer", func(r *River) { r.SourceValue = 9007199254740992 }}, {"zero source", func(r *River) { r.SourceValue = 0 }}, {"path", func(r *River) { r.Slug = "../evil" }}, {"color injection", func(r *River) { r.SourceColor = `red\" onload=alert(1)` }}, {"no title", func(r *River) { r.Title = " " }}, {"duplicate ID", func(r *River) { r.Controls[1].ID = "one" }}, {"too many controls", func(r *River) { r.Controls = make([]Control, 49) }}}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			r := fixture()
			c.change(&r)
			w := request(handler(t.TempDir()), "POST", "/api/rivers", r)
			if w.Code != 422 {
				t.Fatal(w.Code, w.Body)
			}
		})
	}
}
func TestConcurrentEditsDoNotOverwrite(t *testing.T) {
	h := handler(t.TempDir())
	r := decode(t, request(h, "POST", "/api/rivers", fixture()))
	var wg sync.WaitGroup
	codes := make(chan int, 10)
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			v := r
			v.Title = fmt.Sprint(i)
			codes <- request(h, "PUT", "/api/rivers/email-defense", v).Code
		}(i)
	}
	wg.Wait()
	close(codes)
	success := 0
	for c := range codes {
		if c == 200 {
			success++
		} else if c != 409 {
			t.Fatal(c)
		}
	}
	if success != 1 {
		t.Fatalf("%d concurrent writes succeeded", success)
	}
}
func TestMutationBoundaries(t *testing.T) {
	h := handler(t.TempDir())
	b, _ := json.Marshal(fixture())
	for _, origin := range []string{"https://evil.example", "null"} {
		r := httptest.NewRequest("POST", "/api/rivers", bytes.NewReader(b))
		r.Header.Set("Content-Type", "application/json")
		r.Header.Set("Origin", origin)
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		if w.Code != 403 {
			t.Fatal(origin, w.Code)
		}
	}
	r := httptest.NewRequest("POST", "/api/rivers", bytes.NewReader(b))
	w := httptest.NewRecorder()
	h.ServeHTTP(w, r)
	if w.Code != 415 {
		t.Fatal(w.Code)
	}
	if request(h, "GET", "/api/rivers/bad/slug", nil).Code != 404 {
		t.Fatal("bad path")
	}
	if request(h, "PUT", "/api/rivers/missing", fixture()).Code != 400 {
		t.Fatal("slug mismatch")
	}
}
func TestZeroAndLongModel(t *testing.T) {
	r := fixture()
	r.Controls = nil
	for i := 0; i < 48; i++ {
		r.Controls = append(r.Controls, Control{fmt.Sprint(i), "No reduction", 4000000, "remaining", "#215e91", "#4d9eaa"})
	}
	if e := validate(r); e != nil {
		t.Fatal(e)
	}
	r.Controls[0].Remaining = 0
	for i := range r.Controls {
		r.Controls[i].Remaining = 0
	}
	if e := validate(r); e != nil {
		t.Fatal(e)
	}
}
func TestStaticAppAndHealth(t *testing.T) {
	h := handler(t.TempDir())
	for _, path := range []string{"/", "/r/email-defense", "/compare", "/app.js", "/diagram.js", "/style.css", "/healthz"} {
		w := request(h, "GET", path, nil)
		if w.Code != 200 || w.Body.Len() == 0 {
			t.Fatal(path, w.Code)
		}
		if w.Header().Get("Content-Security-Policy") == "" {
			t.Fatal("missing policy")
		}
	}
	if request(h, "GET", "/does-not-exist.js", nil).Code != 404 {
		t.Fatal("missing file")
	}
}

func TestReductionPercentagePreference(t *testing.T) {
	dir := t.TempDir()
	h := handler(dir)
	raw, _ := json.Marshal(fixture())
	var legacy map[string]any
	json.Unmarshal(raw, &legacy)
	delete(legacy, "showPercent")
	w := request(h, "POST", "/api/rivers", legacy)
	if w.Code != 201 {
		t.Fatal(w.Code, w.Body)
	}
	r := decode(t, w)
	if !r.ShowPercent {
		t.Fatal("legacy rivers should show percentages by default")
	}
	r.ShowPercent = false
	w = request(h, "PUT", "/api/rivers/"+r.Slug, r)
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body)
	}
	h = handler(dir)
	r = decode(t, request(h, "GET", "/api/rivers/"+r.Slug, nil))
	if r.ShowPercent {
		t.Fatal("hidden percentage preference was not persisted")
	}
	r.ShowPercent = true
	w = request(h, "PUT", "/api/rivers/"+r.Slug, r)
	if w.Code != 200 || !decode(t, w).ShowPercent {
		t.Fatal("could not restore percentage labels")
	}
	legacy["slug"] = "bad-setting"
	legacy["showPercent"] = "false"
	if request(h, "POST", "/api/rivers", legacy).Code != 400 {
		t.Fatal("nonboolean preference accepted")
	}
}

func TestCountLabelPreference(t *testing.T) {
	dir := t.TempDir()
	h := handler(dir)
	raw, _ := json.Marshal(fixture())
	var legacy map[string]any
	json.Unmarshal(raw, &legacy)
	delete(legacy, "countLabel")
	// Read an old-format file before any mutation; migration must not rewrite it.
	old, _ := json.Marshal(legacy)
	if e := os.WriteFile(filepath.Join(dir, "email-defense.json"), old, 0600); e != nil {
		t.Fatal(e)
	}
	got := decode(t, request(h, "GET", "/api/rivers/email-defense", nil))
	if got.CountLabel != "blocked" {
		t.Fatal("legacy file lost the default label", got.CountLabel)
	}
	unchanged, _ := os.ReadFile(filepath.Join(dir, "email-defense.json"))
	if !bytes.Equal(old, unchanged) {
		t.Fatal("reading rewrote the legacy file")
	}
	legacy["slug"] = "label-preference"
	w := request(h, "POST", "/api/rivers", legacy)
	if w.Code != 201 || decode(t, w).CountLabel != "blocked" {
		t.Fatal(w.Code, w.Body)
	}
	r := decode(t, w)
	for _, label := range []string{"removed", "reduced", "remediated", "  risk  reduced  ", "", strings.Repeat("W", 24)} {
		r.CountLabel = label
		w = request(h, "PUT", "/api/rivers/"+r.Slug, r)
		if w.Code != 200 {
			t.Fatal(w.Code, w.Body)
		}
		h = handler(dir)
		r = decode(t, request(h, "GET", "/api/rivers/"+r.Slug, nil))
		if r.CountLabel != normalizedCountLabel(label) {
			t.Fatal("label not persisted", r.CountLabel, label)
		}
	}
	legacy["slug"] = "invalid-label"
	legacy["countLabel"] = strings.Repeat("W", 25)
	if w = request(h, "POST", "/api/rivers", legacy); w.Code != 422 {
		t.Fatal("long label accepted", w.Code)
	}
	legacy["countLabel"] = 12
	if w = request(h, "POST", "/api/rivers", legacy); w.Code != 400 {
		t.Fatal("non-text label accepted", w.Code)
	}
}
