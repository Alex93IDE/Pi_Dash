import assert from "node:assert/strict";
import { test } from "node:test";
import { iconCandidates, serverSideUrl, sniffType } from "../src/icons.ts";

test("iconCandidates: best first, relative links resolved, favicon.ico last", () => {
  const html = `
    <link rel="stylesheet" href="/app.css">
    <link rel="icon" href="/static/fav-16.png" sizes="16x16">
    <link rel='apple-touch-icon' href='touch.png'>
    <link rel="mask-icon" href="/mask.svg">
    <link rel="icon" type="image/svg+xml" href="/logo.svg">`;
  assert.deepEqual(iconCandidates(html, "http://127.0.0.1:3100/login"), [
    "http://127.0.0.1:3100/logo.svg",
    "http://127.0.0.1:3100/touch.png",
    "http://127.0.0.1:3100/static/fav-16.png",
    "http://127.0.0.1:3100/favicon.ico",
  ]);
  assert.deepEqual(iconCandidates("", "http://127.0.0.1:8080/"), ["http://127.0.0.1:8080/favicon.ico"]);
});

test("sniffType trusts the bytes over the header", () => {
  assert.equal(sniffType(new Uint8Array([0, 0, 1, 0, 1]), "text/plain"), "image/x-icon");
  assert.equal(sniffType(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), null), "image/png");
  assert.equal(sniffType(new TextEncoder().encode('<?xml version="1.0"?><svg/>'), "text/xml"), "image/svg+xml");
  assert.equal(sniffType(new TextEncoder().encode("<!doctype html>"), "text/html"), null);
});

test("serverSideUrl points {host} at this machine", () => {
  assert.equal(serverSideUrl("http://{host}:10086/"), "http://127.0.0.1:10086/");
});
