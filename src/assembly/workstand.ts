#!/usr/bin/env ts-node

import { program } from 'commander';
import inquirer from 'inquirer';
import { createBundle, BundleOptions } from './bundler';
import { PRESETS } from './presets';
import fs from 'fs';
import path from 'path';

// Implementation of interactive CLI
// ...