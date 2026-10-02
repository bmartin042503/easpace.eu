// Copyright (c) 2026 Martin Bartos
// Licensed under the MIT License. See LICENSE file for details.

// module entry point; modules run after the document is parsed, so the markup is available here
import { initI18n } from "./i18n.js";
import { initTheme } from "./theme.js";

// language first: Hungarian visitors see the page only once it's translated
initI18n();
initTheme();
