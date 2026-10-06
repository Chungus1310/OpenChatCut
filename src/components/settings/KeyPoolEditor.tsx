import { useState } from 'react';
import { useT } from '../../i18n/locale';
import { theme, themeAlpha } from '../../theme';
import type { KeyPoolSummary, KeyStatusResponse, SettingsField } from './settingsFields';

interface KeyPoolEditorProps {
  readonly provider: string;
  readonly keyPoolName: string;
  readonly apiKeyName?: string;
  readonly status: KeyStatusResponse | null;
  readonly stagedValue?: string;
  readonly onStage: (field: SettingsField, raw: string) => void;
}

const statusColors: Record<string, { bg: string; text: string; label: string; icon: string }> = {
  working: { bg: 'rgba(34, 197, 94, 0.15)', text: '#22c55e', label: '正常', icon: '●' },
  'rate-limited': { bg: 'rgba(234, 179, 8, 0.15)', text: '#eab308', label: '限流', icon: '▲' },
  failed: { bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444', label: '异常', icon: '✕' },
  untested: { bg: 'rgba(148, 163, 184, 0.15)', text: '#94a3b8', label: '待测', icon: '○' },
};

function parseKeysFromStaged(raw?: string): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(String).filter((k) => k.trim().length > 0);
  } catch {
    // newline or comma
  }
  return raw
    .split(/[\r\n,]+/)
    .map((k) => k.trim())
    .filter((k) => k.length > 0);
}

function maskKey(key: string): string {
  if (key.length <= 8) return '••••••••';
  return `${key.slice(0, 4)}••••${key.slice(-4)}`;
}

export function KeyPoolEditor({
  provider,
  keyPoolName,
  status,
  stagedValue,
  onStage,
}: KeyPoolEditorProps) {
  const t = useT();
  const [expanded, setExpanded] = useState(false);
  const [newKeyInput, setNewKeyInput] = useState('');
  const [showRawKeys, setShowRawKeys] = useState(false);

  const poolSummary: KeyPoolSummary | undefined =
    status?.keyPools?.[provider] ?? (keyPoolName ? status?.keyPools?.[keyPoolName] : undefined);
  const stagedKeys = parseKeysFromStaged(stagedValue);

  // If user staged new keys, use staged keys count; otherwise use status
  const totalKeys = stagedValue !== undefined ? stagedKeys.length : (poolSummary?.totalKeys || 0);
  const hasPool = totalKeys > 0;

  const keyPoolField: SettingsField = {
    name: keyPoolName,
    label: 'API Key 轮换池',
    kind: 'text',
  };

  const handleAddKeys = () => {
    const trimmed = newKeyInput.trim();
    if (!trimmed) return;
    const added = trimmed
      .split(/[\r\n,]+/)
      .map((k) => k.trim())
      .filter((k) => k.length > 0);
    const existing = stagedValue !== undefined ? stagedKeys : [];
    const merged = [...new Set([...existing, ...added])];
    onStage(keyPoolField, JSON.stringify(merged));
    setNewKeyInput('');
  };

  const handleRemoveKey = (index: number) => {
    const existing = stagedValue !== undefined ? [...stagedKeys] : [];
    existing.splice(index, 1);
    onStage(keyPoolField, existing.length > 0 ? JSON.stringify(existing) : '');
  };

  const handleClearPool = () => {
    onStage(keyPoolField, '');
  };

  return (
    <div
      style={{
        marginTop: 10,
        padding: '10px 12px',
        borderRadius: 8,
        border: `1px solid ${theme.border}`,
        background: theme.panelAlt,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          userSelect: 'none',
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: theme.textStrong }}>
            {t('多 Key 智能轮换与容灾池')}
          </span>
          {hasPool ? (
            <span
              style={{
                fontSize: 11,
                padding: '1px 7px',
                borderRadius: 999,
                background: 'rgba(34, 197, 94, 0.15)',
                color: '#22c55e',
                fontWeight: 500,
              }}
            >
              {t('{n} 个 Key', { n: totalKeys })}
            </span>
          ) : (
            <span
              style={{
                fontSize: 11,
                padding: '1px 7px',
                borderRadius: 999,
                background: themeAlpha.ink(0.08),
                color: theme.textDim,
              }}
            >
              {t('单 Key 模式')}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 11, color: theme.textDim }}>
            {expanded ? t('收起') : t('管理池')}
          </span>
          <span
            style={{
              fontSize: 10,
              color: theme.textDim,
              transform: expanded ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.15s ease',
            }}
          >
            ▼
          </span>
        </div>
      </div>

      {expanded && (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 11, color: theme.textDim, lineHeight: 1.5 }}>
            {t(
              '配置多个 API Key 可以在遇到 429 限流或额度告警时自动平滑转移。采用粘性选择（Sticky Selection）优先复用工作 Key 以保持服务端的 Prompt Cache 热度，并在流式输出已产生后提供防重复计费保护。'
            )}
          </div>

          {/* Key list */}
          {stagedKeys.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {stagedKeys.map((key, index) => {
                const statusKind = poolSummary?.statuses[index] || 'untested';
                const st = statusColors[statusKind] || statusColors.untested;
                const isCurrent = poolSummary?.currentIndex === index;

                return (
                  <div
                    key={`${index}-${key}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '5px 8px',
                      borderRadius: 6,
                      background: isCurrent ? themeAlpha.ink(0.08) : theme.inset,
                      border: isCurrent
                        ? `1px solid ${theme.accent ?? '#3b82f6'}`
                        : `1px solid ${theme.border}`,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: isCurrent ? (theme.accent ?? '#3b82f6') : theme.textDim,
                        }}
                      >
                        #{index + 1}
                      </span>
                      <span
                        style={{
                          fontFamily: 'monospace',
                          fontSize: 11.5,
                          color: theme.textStrong,
                        }}
                      >
                        {showRawKeys ? key : maskKey(key)}
                      </span>
                      {isCurrent && (
                        <span
                          style={{
                            fontSize: 10,
                            padding: '1px 5px',
                            borderRadius: 4,
                            background: 'rgba(59, 130, 246, 0.15)',
                            color: '#3b82f6',
                            fontWeight: 600,
                          }}
                        >
                          {t('当前活跃 (Sticky)')}
                        </span>
                      )}
                      <span
                        style={{
                          fontSize: 10.5,
                          padding: '1px 6px',
                          borderRadius: 4,
                          background: st.bg,
                          color: st.text,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 3,
                        }}
                      >
                        <span>{st.icon}</span>
                        <span>{t(st.label)}</span>
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveKey(index)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: theme.textDim,
                        cursor: 'pointer',
                        fontSize: 12,
                        padding: '2px 5px',
                      }}
                      title={t('删除此 Key')}
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          ) : poolSummary && poolSummary.totalKeys > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {poolSummary.statuses.map((statusKind, index) => {
                const st = statusColors[statusKind] || statusColors.untested;
                const isCurrent = poolSummary.currentIndex === index;
                return (
                  <div
                    key={`persisted-${index}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '5px 8px',
                      borderRadius: 6,
                      background: isCurrent ? themeAlpha.ink(0.08) : theme.inset,
                      border: isCurrent
                        ? `1px solid ${theme.accent ?? '#3b82f6'}`
                        : `1px solid ${theme.border}`,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: isCurrent ? (theme.accent ?? '#3b82f6') : theme.textDim,
                        }}
                      >
                        #{index + 1}
                      </span>
                      <span
                        style={{
                          fontFamily: 'monospace',
                          fontSize: 11.5,
                          color: theme.textStrong,
                        }}
                      >
                        •••••••• <span style={{ fontSize: 10.5, color: theme.textDim }}>({t('已持久化')})</span>
                      </span>
                      {isCurrent && (
                        <span
                          style={{
                            fontSize: 10,
                            padding: '1px 5px',
                            borderRadius: 4,
                            background: 'rgba(59, 130, 246, 0.15)',
                            color: '#3b82f6',
                            fontWeight: 600,
                          }}
                        >
                          {t('当前活跃 (Sticky)')}
                        </span>
                      )}
                      <span
                        style={{
                          fontSize: 10.5,
                          padding: '1px 6px',
                          borderRadius: 4,
                          background: st.bg,
                          color: st.text,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 3,
                        }}
                      >
                        <span>{st.icon}</span>
                        <span>{t(st.label)}</span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div
              style={{
                fontSize: 11.5,
                color: theme.textDim,
                padding: '8px 10px',
                borderRadius: 6,
                background: theme.inset,
                textAlign: 'center',
              }}
            >
              {t('暂无多 Key 配置（当前使用上方默认单 Key）')}
            </div>
          )}

          {/* Add new key input */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'stretch' }}>
            <input
              type={showRawKeys ? 'text' : 'password'}
              placeholder={t('添加一个或多个 API Key（支持逗号或换行分隔）')}
              value={newKeyInput}
              onChange={(e) => setNewKeyInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddKeys();
                }
              }}
              style={{
                flex: 1,
                fontSize: 12,
                padding: '6px 10px',
                borderRadius: 6,
                border: `1px solid ${theme.border}`,
                background: theme.inset,
                color: theme.textStrong,
                outline: 'none',
              }}
            />
            <button
              type="button"
              onClick={handleAddKeys}
              disabled={!newKeyInput.trim()}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: 'none',
                background: newKeyInput.trim() ? (theme.accent ?? '#3b82f6') : theme.border,
                color: '#fff',
                fontSize: 12,
                fontWeight: 500,
                cursor: newKeyInput.trim() ? 'pointer' : 'default',
              }}
            >
              {t('加入池')}
            </button>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => setShowRawKeys(!showRawKeys)}
              style={{
                background: 'transparent',
                border: 'none',
                color: theme.textDim,
                fontSize: 11,
                cursor: 'pointer',
                padding: 0,
                textDecoration: 'underline',
              }}
            >
              {showRawKeys ? t('隐藏明文') : t('显示明文')}
            </button>

            {(stagedKeys.length > 0 || (poolSummary && poolSummary.totalKeys > 0)) && (
              <button
                type="button"
                onClick={handleClearPool}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#ef4444',
                  fontSize: 11,
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                {t('清空轮换池')}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
