/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ProjectKind, ScriptSectionKind } from '../../types';

export type ProjectTemplate = {
  id: string;
  label: string;
  kind: ProjectKind;
  description: string;
  defaultSections: Array<{ title: string; kind: ScriptSectionKind }>;
  recommendedDefaults?: {
    language_code?: string;
    style_id?: number;
    metadata?: Record<string, unknown>;
  };
};

export const BLANK_PROJECT_TEMPLATE_ID = 'blank';
export const DEFAULT_PROJECT_TEMPLATE_ID = 'audiobook_chapters';

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: 'audiobook_chapters',
    label: 'Audiobook Chapters',
    kind: 'audiobook',
    description: 'Long-form narration with chapter sections ready for import or drafting.',
    defaultSections: [
      { title: 'Chapter 1', kind: 'chapter' },
      { title: 'Chapter 2', kind: 'chapter' },
    ],
    recommendedDefaults: {
      language_code: 'en',
      metadata: { workflow: 'long_form_narration' },
    },
  },
  {
    id: 'voiceover_spot',
    label: 'Voiceover Spot',
    kind: 'voiceover',
    description: 'Commercial or promo copy with production and alternate-read sections.',
    defaultSections: [
      { title: 'Main Read', kind: 'scene' },
      { title: 'Alternate Reads', kind: 'scene' },
    ],
    recommendedDefaults: {
      language_code: 'en',
      metadata: { workflow: 'commercial_spot' },
    },
  },
  {
    id: 'podcast_episode',
    label: 'Podcast Episode',
    kind: 'podcast',
    description: 'Episode narration with intro, body, and outro blocks.',
    defaultSections: [
      { title: 'Intro', kind: 'chapter' },
      { title: 'Main Segment', kind: 'chapter' },
      { title: 'Outro', kind: 'chapter' },
    ],
    recommendedDefaults: {
      language_code: 'en',
      metadata: { workflow: 'episode' },
    },
  },
  {
    id: 'training_module',
    label: 'Training Module',
    kind: 'training',
    description: 'Instructional narration organized into module sections.',
    defaultSections: [
      { title: 'Overview', kind: 'chapter' },
      { title: 'Lesson 1', kind: 'chapter' },
      { title: 'Recap', kind: 'chapter' },
    ],
    recommendedDefaults: {
      language_code: 'en',
      metadata: { workflow: 'learning' },
    },
  },
  {
    id: 'character_reel',
    label: 'Character Reel',
    kind: 'character_reel',
    description: 'Character voice development with notes and audition lines.',
    defaultSections: [
      { title: 'Character Notes', kind: 'folder' },
      { title: 'Audition Lines', kind: 'scene' },
    ],
    recommendedDefaults: {
      language_code: 'en',
      metadata: { workflow: 'casting' },
    },
  },
  {
    id: BLANK_PROJECT_TEMPLATE_ID,
    label: 'Blank Project',
    kind: 'audiobook',
    description: 'Start with an empty project and add structure later.',
    defaultSections: [],
    recommendedDefaults: {
      language_code: 'en',
    },
  },
];

export function getProjectTemplate(id: string): ProjectTemplate {
  return PROJECT_TEMPLATES.find(template => template.id === id) ?? PROJECT_TEMPLATES[0];
}
