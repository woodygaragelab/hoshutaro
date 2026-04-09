/**
 * Plugin API Service — バックエンド Plugin/Skills/Update REST API クライアント
 *
 * Phase 4A: フロントエンドから Phase 2-3 バックエンド API を呼び出す統一サービス
 */

import type {
  PluginInfo,
  PluginRegistry,
  LicenseInfo,
  SkillDefinition,
  SkillExecutionProgress,
  UpdateInfo,
} from './types';

// ── Helpers ─────────────────────────────────────────

const API_BASE = '';  // same-origin

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(body.detail || `API Error ${res.status}`);
  }
  return res.json();
}

// ── Plugin APIs ─────────────────────────────────────

/** インストール済みプラグイン一覧 */
export async function fetchPlugins(): Promise<PluginInfo[]> {
  const data = await apiFetch<{ plugins: PluginInfo[] }>('/api/plugins');
  return data.plugins;
}

/** 利用可能プラグインレジストリ */
export async function fetchRegistry(): Promise<PluginRegistry> {
  return apiFetch<PluginRegistry>('/api/plugins/registry');
}

/** プラグインインストール */
export async function installPlugin(pluginId: string): Promise<{ status: string }> {
  return apiFetch(`/api/plugins/${pluginId}/install`, { method: 'POST' });
}

/** プラグインアンインストール */
export async function uninstallPlugin(pluginId: string): Promise<{ status: string }> {
  return apiFetch(`/api/plugins/${pluginId}`, { method: 'DELETE' });
}

/** プラグイン起動 */
export async function startPlugin(pluginId: string): Promise<{ status: string }> {
  return apiFetch(`/api/plugins/${pluginId}/start`, { method: 'POST' });
}

/** プラグイン停止 */
export async function stopPlugin(pluginId: string): Promise<{ status: string }> {
  return apiFetch(`/api/plugins/${pluginId}/stop`, { method: 'POST' });
}

/** プラグイン設定取得 */
export async function fetchPluginConfig(pluginId: string): Promise<{
  manifest: Record<string, unknown>;
  config: Record<string, string>;
}> {
  return apiFetch(`/api/plugins/${pluginId}/config`);
}

/** プラグイン設定更新 */
export async function updatePluginConfig(
  pluginId: string,
  config: Record<string, string>
): Promise<{ status: string }> {
  return apiFetch(`/api/plugins/${pluginId}/config`, {
    method: 'PUT',
    body: JSON.stringify({ config }),
  });
}

/** プラグイン更新チェック */
export async function checkPluginUpdates(): Promise<{
  updates: Array<{ id: string; currentVersion: string; latestVersion: string }>;
}> {
  return apiFetch('/api/plugins/updates/check');
}

/** ライセンス情報取得 */
export async function fetchLicenseInfo(): Promise<LicenseInfo> {
  return apiFetch('/api/plugins/license');
}

// ── Skills APIs ─────────────────────────────────────

/** Skill 一覧取得 */
export async function fetchSkills(): Promise<SkillDefinition[]> {
  const data = await apiFetch<{ skills: SkillDefinition[] }>('/api/skills');
  return data.skills;
}

/** Skill 詳細取得 */
export async function fetchSkillDetail(skillId: string): Promise<SkillDefinition> {
  const data = await apiFetch<{ skill: SkillDefinition }>(`/api/skills/${skillId}`);
  return data.skill;
}

/** Skill 実行 */
export async function executeSkill(
  skillId: string,
  params: Record<string, unknown>
): Promise<{ execution_id: string }> {
  return apiFetch(`/api/skills/${skillId}/execute`, {
    method: 'POST',
    body: JSON.stringify({ parameters: params }),
  });
}

/** Skill 実行状態取得 */
export async function getSkillExecutionStatus(
  executionId: string
): Promise<SkillExecutionProgress> {
  return apiFetch(`/api/skills/execution/${executionId}/status`);
}

/** ユーザー Skill 作成 */
export async function createUserSkill(yaml: string): Promise<{ skill_id: string }> {
  return apiFetch('/api/skills/user', {
    method: 'POST',
    body: JSON.stringify({ yaml_content: yaml }),
  });
}

/** ユーザー Skill 更新 */
export async function updateUserSkill(
  skillId: string,
  yaml: string
): Promise<{ status: string }> {
  return apiFetch(`/api/skills/user/${skillId}`, {
    method: 'PUT',
    body: JSON.stringify({ yaml_content: yaml }),
  });
}

/** ユーザー Skill 削除 */
export async function deleteUserSkill(skillId: string): Promise<{ status: string }> {
  return apiFetch(`/api/skills/user/${skillId}`, { method: 'DELETE' });
}

// ── Update APIs ─────────────────────────────────────

/** アプリ更新チェック */
export async function checkAppUpdate(): Promise<UpdateInfo> {
  return apiFetch('/api/updates/check');
}

/** アプリ更新適用 */
export async function applyAppUpdate(): Promise<{ status: string }> {
  return apiFetch('/api/updates/apply', { method: 'POST' });
}
