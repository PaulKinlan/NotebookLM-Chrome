// ============================================================================
// TSX Entry Point
// ============================================================================
import { App } from './App';
import * as Index from './index';

// The TSX components are ready but not yet integrated.
// For now, delegate to the existing index.ts which has all the business logic.
//
// TODO: Complete migration by:
// 1. Moving state management here
// 2. Creating event handlers that call into Index functions
// 3. Rendering <App /> with state and handlers
// 4. Simplifying index.html to just <div id="app"></div>

export * from './index';
