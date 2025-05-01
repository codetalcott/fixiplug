# FixiPlugs: Fixi Plugin System (pre-alpha)
<!-- Badges -->
<!-- [![npm version](https://img.shields.io/npm/v/fixi-plugins.svg)](https://www.npmjs.com/package/fixi-plugins)  
[![Build Status](https://github.com/your-org/fixiplug/actions/workflows/ci.yml/badge.svg)](https://github.com/your-org/fixiplug/actions/workflows/ci.yml)   -->
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

FixiPlugs aims to be a high-performance, composable plugin system for the tiny Fixi HTTP library. The project has two goals: to provide an ESM version of fixi, and offer a lightweight framework to extend and customize behavior (caching, offline support, analytics, accessibility, loading indicators, etc.) without modifying the core library.

## Why a Plugin System for Fixi?

Fixi provides a wonderfully focused core. Plugins let you opt-in only to what's necessary for a specific project. Start with bare-bones Fixi, then progressively add capabilities as your applications demand. This approach allows Fixi to grow its capabilities without growing its footprint.
