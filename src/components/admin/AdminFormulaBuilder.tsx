import React, { useEffect, useMemo, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { CheckCircle2, Eye, History, Play, Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../../firebase';
import { makeSafeId, useApp } from '../../context/AppContext';
import {
  CalculatorCondition,
  CalculatorDefinition,
  CalculatorInputField,
  CalculatorOutputField,
  FormulaVersionRecord,
} from '../../types';
import { runDynamicCalculator, validateExpressionSyntax } from '../../engine/formulaParser';
import { UNIT_DIMENSIONS } from '../../engine/unitConverter';
import { DynamicCalculatorRunner } from '../calculators/DynamicCalculatorRunner';

export const AdminFormulaBuilder: React.FC = () => {
  const { user, categories, calculators, units, logAdminAudit, showToast } = useApp();

  const [selectedId, setSelectedId] = useState<string>('NEW');
  const [draft, setDraft] = useState<CalculatorDefinition>({
    id: makeSafeId('custom-calc'),
    categoryId: categories[0]?.id || 'electrical',
    nameEn: 'New Custom Calculator',
    nameBn: 'নতুন কাস্টম ক্যালকুলেটর',
    descriptionEn: 'Dynamic formula configured from Admin Console.',
    descriptionBn: 'অ্যাডমিন প্যানেল থেকে কনফিগার করা সূত্র।',
    formulaDisplay: 'Y = A * B',
    formulaReference: '',
    explanationEn: '',
    explanationBn: '',
    disclaimerEn: '',
    disclaimerBn: '',
    inputs: [
      {
        key: 'A',
        labelEn: 'Parameter A',
        labelBn: 'মান A',
        dataType: 'number',
        required: true,
        defaultValue: 10,
      },
      {
        key: 'B',
        labelEn: 'Parameter B',
        labelBn: 'মান B',
        dataType: 'number',
        required: true,
        defaultValue: 5,
      },
    ],
    outputs: [
      {
        key: 'Y',
        labelEn: 'Calculated Result Y',
        labelBn: 'ফলাফল Y',
        expression: 'A * B',
        unit: '',
        precision: 2,
        primary: true,
      },
    ],
    conditions: [],
    exampleInputs: { A: 10, B: 5 },
    version: 1,
    enabled: true,
    published: true,
  });

  const [changeNote, setChangeNote] = useState('Updated formula parameters');
  const [previewMode, setPreviewMode] = useState(false);
  const [versions, setVersions] = useState<FormulaVersionRecord[]>([]);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [sandboxInputs, setSandboxInputs] = useState<Record<string, number>>({ A: 10, B: 5 });

  const loadCalculator = (calc: CalculatorDefinition) => {
    setSelectedId(calc.id);
    setDraft(JSON.parse(JSON.stringify(calc)));
    const sInputs: Record<string, number> = {};
    for (const inp of calc.inputs) sInputs[inp.key] = inp.defaultValue;
    setSandboxInputs(sInputs);
    setConfirmDelete(false);
    setPreviewMode(false);
  };

  const startNew = () => {
    setSelectedId('NEW');
    setConfirmDelete(false);
    setSandboxInputs({ x: 10, y: 2 });
    setDraft({
      id: makeSafeId('calc'),
      categoryId: 'electrical',
      nameEn: 'New Engineering Calculator',
      nameBn: 'নতুন ইঞ্জিনিয়ারিং ক্যালকুলেটর',
      descriptionEn: '',
      descriptionBn: '',
      formulaDisplay: 'Result = x * y',
      formulaReference: '',
      explanationEn: '',
      explanationBn: '',
      disclaimerEn: '',
      disclaimerBn: '',
      inputs: [
        { key: 'x', labelEn: 'Input X', labelBn: 'ইনপুট X', dataType: 'number', required: true, defaultValue: 10 },
        { key: 'y', labelEn: 'Input Y', labelBn: 'ইনপুট Y', dataType: 'number', required: true, defaultValue: 2 },
      ],
      outputs: [
        { key: 'res', labelEn: 'Result', labelBn: 'ফলাফল', expression: 'x * y', unit: '', precision: 2, primary: true },
      ],
      conditions: [],
      version: 1,
      enabled: true,
      published: false,
    });
  };

  // Load version history for selected calculator
  useEffect(() => {
    if (selectedId === 'NEW') {
      setVersions([]);
      return;
    }
    getDocs(query(collection(db, 'formulaVersions'), where('calculatorId', '==', selectedId)))
      .then((snap) => {
        const list = snap.docs.map((d) => d.data() as FormulaVersionRecord);
        list.sort((a, b) => b.version - a.version);
        setVersions(list);
      })
      .catch(() => setVersions([]));
  }, [selectedId]);

  const allowedVars = useMemo(() => {
    const vars = draft.inputs.map((i) => i.key);
    for (const o of draft.outputs) vars.push(o.key);
    return vars;
  }, [draft.inputs, draft.outputs]);

  const syntaxAudit = useMemo(() => {
    const errors: string[] = [];
    for (const out of draft.outputs) {
      const res = validateExpressionSyntax(out.expression, allowedVars);
      if (!res.valid) errors.push(`Output "${out.key}": ${res.error}`);
    }
    for (const cond of draft.conditions || []) {
      const res = validateExpressionSyntax(cond.expression, allowedVars);
      if (!res.valid) errors.push(`Condition "${cond.id}": ${res.error}`);
    }
    return errors;
  }, [draft.outputs, draft.conditions, allowedVars]);

  const testRunResult = useMemo(() => {
    const testScope: Record<string, number> = {};
    for (const inp of draft.inputs) {
      const val = sandboxInputs[inp.key];
      testScope[inp.key] = val !== undefined && Number.isFinite(val) ? val : inp.defaultValue;
    }
    return runDynamicCalculator(draft, testScope, {}, units);
  }, [draft, sandboxInputs, units]);

  const handleSaveCalculator = async (publishNow?: boolean) => {
    if (!user) return;
    if (syntaxAudit.length > 0) {
      showToast(syntaxAudit[0], 'error');
      return;
    }
    setSaving(true);
    try {
      const cleanId = draft.id.replace(/[^a-zA-Z0-9_-]/g, '-');
      const nextVersion = selectedId === 'NEW' ? 1 : (draft.version || 1) + 1;
      const payload: CalculatorDefinition = {
        ...draft,
        id: cleanId,
        version: nextVersion,
        published: publishNow !== undefined ? publishNow : draft.published,
        updatedBy: user.uid,
      };

      await setDoc(doc(db, 'calculators', cleanId), {
        ...payload,
        updatedAt: serverTimestamp(),
      });

      const formulaExpr =
        payload.outputs.map((o) => `${o.key}=${o.expression}`).join('; ').slice(0, 490) ||
        payload.formulaDisplay.slice(0, 490) ||
        'y=x';
      await setDoc(doc(db, 'formulas', cleanId), {
        id: cleanId,
        calculatorId: cleanId,
        expression: formulaExpr,
        version: nextVersion,
        updatedAt: serverTimestamp(),
      });

      const verId = makeSafeId(`ver-${cleanId}`);
      await setDoc(doc(db, 'formulaVersions', verId), {
        id: verId,
        calculatorId: cleanId,
        version: nextVersion,
        snapshot: payload,
        changeNote: changeNote || `v${nextVersion}`,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
      });

      await logAdminAudit(
        selectedId === 'NEW' ? 'CREATE_CALCULATOR' : 'UPDATE_CALCULATOR',
        'calculators',
        cleanId,
        `${payload.nameEn} (v${nextVersion}, published=${payload.published})`
      );

      setSelectedId(cleanId);
      setDraft(payload);
      showToast(`Saved "${payload.nameEn}" v${nextVersion} to Firestore.`, 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `calculators/${draft.id}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCalculator = async () => {
    if (!user || selectedId === 'NEW') return;
    setSaving(true);
    try {
      await deleteDoc(doc(db, 'calculators', selectedId));
      await deleteDoc(doc(db, 'formulas', selectedId)).catch(() => {});
      await logAdminAudit('DELETE_CALCULATOR', 'calculators', selectedId, `Deleted calculator ${draft.nameEn}`);
      showToast(`Deleted "${draft.nameEn}".`, 'info');
      startNew();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `calculators/${selectedId}`);
    } finally {
      setSaving(false);
    }
  };

  const restoreVersion = (ver: FormulaVersionRecord) => {
    setDraft({ ...ver.snapshot });
    showToast(`Loaded v${ver.version} into editor. Click Save to commit restoration.`, 'info');
  };

  const addInput = () => {
    const nextKey = `x${draft.inputs.length + 1}`;
    const newField: CalculatorInputField = {
      key: nextKey,
      labelEn: `Parameter ${nextKey}`,
      labelBn: `মান ${nextKey}`,
      dataType: 'number',
      required: true,
      defaultValue: 1,
    };
    setDraft((p) => ({ ...p, inputs: [...p.inputs, newField] }));
  };

  const addOutput = () => {
    const nextKey = `out${draft.outputs.length + 1}`;
    const newOut: CalculatorOutputField = {
      key: nextKey,
      labelEn: `Output ${nextKey}`,
      labelBn: `ফলাফল ${nextKey}`,
      expression: draft.inputs[0]?.key || '0',
      unit: '',
      precision: 2,
      primary: false,
    };
    setDraft((p) => ({ ...p, outputs: [...p.outputs, newOut] }));
  };

  const addCondition = () => {
    const newCond: CalculatorCondition = {
      id: makeSafeId('cond'),
      expression: `${draft.inputs[0]?.key || 'x'} < 0`,
      severity: 'warning',
      messageEn: 'Value is negative.',
      messageBn: 'মান ঋণাত্মক।',
    };
    setDraft((p) => ({ ...p, conditions: [...(p.conditions || []), newCond] }));
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
      {/* Left Calculator Directory */}
      <div className="xl:col-span-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
        <button
          type="button"
          onClick={startNew}
          className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-700 py-2 text-xs font-medium text-white hover:bg-blue-800 cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Create New Calculator</span>
        </button>

        <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[600px] overflow-y-auto">
          {calculators.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => loadCalculator(c)}
              className={`w-full text-left py-2.5 px-2.5 rounded transition-colors cursor-pointer ${
                selectedId === c.id ? 'bg-blue-50 dark:bg-blue-950/40' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                  {c.nameEn}
                </span>
                <span className="text-[10px] text-slate-500 shrink-0">
                  v{c.version} · {c.published ? 'Live' : 'Draft'}
                </span>
              </div>
              <p className="text-[11px] font-mono-tabular text-slate-500 truncate">
                {c.formulaDisplay}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Right Visual Builder */}
      <div className="xl:col-span-8 space-y-5">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {selectedId === 'NEW' ? 'New Calculator Builder' : `Editing: ${draft.nameEn} (v${draft.version})`}
            </h3>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setPreviewMode((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>{previewMode ? 'Back to Editor' : 'Preview Mode'}</span>
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => handleSaveCalculator(false)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-xs font-medium cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Draft</span>
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => handleSaveCalculator(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-blue-800 cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Publish v{selectedId === 'NEW' ? 1 : draft.version + 1}</span>
              </button>
              {selectedId !== 'NEW' && (
                confirmDelete ? (
                  <button
                    type="button"
                    disabled={saving}
                    onClick={handleDeleteCalculator}
                    className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Confirm Delete</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="inline-flex items-center gap-1 rounded-lg border border-red-200 dark:border-red-900 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                )
              )}
            </div>
          </div>

          {previewMode ? (
            <DynamicCalculatorRunner calculator={draft} />
          ) : (
            <div className="space-y-5">
              {/* Metadata */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Calculator ID (slug)</label>
                  <input
                    type="text"
                    value={draft.id}
                    disabled={selectedId !== 'NEW'}
                    onChange={(e) => setDraft({ ...draft, id: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs font-mono disabled:opacity-60"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Category</label>
                  <select
                    value={draft.categoryId}
                    onChange={(e) => setDraft({ ...draft, categoryId: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs"
                  >
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.nameEn}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Name (English)</label>
                  <input
                    type="text"
                    value={draft.nameEn}
                    onChange={(e) => setDraft({ ...draft, nameEn: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Name (বাংলা)</label>
                  <input
                    type="text"
                    value={draft.nameBn}
                    onChange={(e) => setDraft({ ...draft, nameBn: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium mb-1">Human-Readable Formula Display</label>
                  <input
                    type="text"
                    value={draft.formulaDisplay}
                    onChange={(e) => setDraft({ ...draft, formulaDisplay: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Description (English)</label>
                  <input
                    type="text"
                    value={draft.descriptionEn || ''}
                    onChange={(e) => setDraft({ ...draft, descriptionEn: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Description (বাংলা)</label>
                  <input
                    type="text"
                    value={draft.descriptionBn || ''}
                    onChange={(e) => setDraft({ ...draft, descriptionBn: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium mb-1">Standard / Reference (IEC, ACI, etc.)</label>
                  <input
                    type="text"
                    value={draft.formulaReference || ''}
                    onChange={(e) => setDraft({ ...draft, formulaReference: e.target.value })}
                    placeholder="e.g. IEC 60364 / BNBC 2020"
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Explanation (EN)</label>
                  <textarea
                    rows={2}
                    value={draft.explanationEn || ''}
                    onChange={(e) => setDraft({ ...draft, explanationEn: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Explanation (BN)</label>
                  <textarea
                    rows={2}
                    value={draft.explanationBn || ''}
                    onChange={(e) => setDraft({ ...draft, explanationBn: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Engineering Disclaimer (EN)</label>
                  <input
                    type="text"
                    value={draft.disclaimerEn || ''}
                    onChange={(e) => setDraft({ ...draft, disclaimerEn: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Engineering Disclaimer (BN)</label>
                  <input
                    type="text"
                    value={draft.disclaimerBn || ''}
                    onChange={(e) => setDraft({ ...draft, disclaimerBn: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs"
                  />
                </div>
              </div>

              {/* Inputs Builder */}
              <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold">Input Variables</h4>
                  <button
                    type="button"
                    onClick={addInput}
                    className="text-xs font-medium text-blue-700 dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    + Add Input Field
                  </button>
                </div>
                <div className="space-y-2">
                  {draft.inputs.map((inp, idx) => (
                    <div key={idx} className="rounded-lg border border-slate-200 dark:border-slate-800 p-2.5 space-y-2">
                      <div className="grid grid-cols-12 gap-2 items-center">
                        <input
                          type="text"
                          value={inp.key}
                          onChange={(e) =>
                            setDraft((p) => ({
                              ...p,
                              inputs: p.inputs.map((item, i) =>
                                i === idx ? { ...item, key: e.target.value.replace(/[^a-zA-Z0-9_]/g, '') } : item
                              ),
                            }))
                          }
                          placeholder="Var"
                          className="col-span-2 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1 text-xs font-mono"
                        />
                        <input
                          type="text"
                          value={inp.labelEn}
                          onChange={(e) =>
                            setDraft((p) => ({
                              ...p,
                              inputs: p.inputs.map((item, i) => (i === idx ? { ...item, labelEn: e.target.value } : item)),
                            }))
                          }
                          placeholder="Label EN"
                          className="col-span-3 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1 text-xs"
                        />
                        <input
                          type="text"
                          value={inp.labelBn}
                          onChange={(e) =>
                            setDraft((p) => ({
                              ...p,
                              inputs: p.inputs.map((item, i) => (i === idx ? { ...item, labelBn: e.target.value } : item)),
                            }))
                          }
                          placeholder="Label BN"
                          className="col-span-3 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1 text-xs"
                        />
                        <input
                          type="number"
                          value={inp.defaultValue}
                          onChange={(e) =>
                            setDraft((p) => ({
                              ...p,
                              inputs: p.inputs.map((item, i) =>
                                i === idx ? { ...item, defaultValue: Number(e.target.value) } : item
                              ),
                            }))
                          }
                          placeholder="Default"
                          className="col-span-2 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1 text-xs font-mono"
                        />
                        <input
                          type="text"
                          value={inp.defaultUnit || ''}
                          onChange={(e) =>
                            setDraft((p) => ({
                              ...p,
                              inputs: p.inputs.map((item, i) =>
                                i === idx ? { ...item, defaultUnit: e.target.value } : item
                              ),
                            }))
                          }
                          placeholder="Unit"
                          className="col-span-1 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-1.5 py-1 text-xs"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setDraft((p) => ({ ...p, inputs: p.inputs.filter((_, i) => i !== idx) }))
                          }
                          className="col-span-1 flex justify-center text-slate-400 hover:text-red-600 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="grid grid-cols-12 gap-2 items-center text-[11px]">
                        <select
                          value={inp.unitDimension || ''}
                          onChange={(e) =>
                            setDraft((p) => ({
                              ...p,
                              inputs: p.inputs.map((item, i) =>
                                i === idx ? { ...item, unitDimension: e.target.value || undefined } : item
                              ),
                            }))
                          }
                          className="col-span-4 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1 text-[11px]"
                        >
                          <option value="">No Unit Dimension</option>
                          {UNIT_DIMENSIONS.map((d) => (
                            <option key={d.id} value={d.id}>
                              Unit Group: {d.labelEn}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          step="any"
                          value={inp.min ?? ''}
                          onChange={(e) =>
                            setDraft((p) => ({
                              ...p,
                              inputs: p.inputs.map((item, i) =>
                                i === idx
                                  ? { ...item, min: e.target.value === '' ? undefined : Number(e.target.value) }
                                  : item
                              ),
                            }))
                          }
                          placeholder="Min (opt)"
                          className="col-span-3 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1 text-[11px] font-mono"
                        />
                        <input
                          type="number"
                          step="any"
                          value={inp.max ?? ''}
                          onChange={(e) =>
                            setDraft((p) => ({
                              ...p,
                              inputs: p.inputs.map((item, i) =>
                                i === idx
                                  ? { ...item, max: e.target.value === '' ? undefined : Number(e.target.value) }
                                  : item
                              ),
                            }))
                          }
                          placeholder="Max (opt)"
                          className="col-span-3 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1 text-[11px] font-mono"
                        />
                        <label className="col-span-2 inline-flex items-center gap-1 text-[11px]">
                          <input
                            type="checkbox"
                            checked={inp.required}
                            onChange={(e) =>
                              setDraft((p) => ({
                                ...p,
                                inputs: p.inputs.map((item, i) =>
                                  i === idx ? { ...item, required: e.target.checked } : item
                                ),
                              }))
                            }
                          />
                          <span>Req</span>
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Outputs Builder */}
              <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold">Output Formulas (Safe AST Parser — No eval)</h4>
                  <button
                    type="button"
                    onClick={addOutput}
                    className="text-xs font-medium text-blue-700 dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    + Add Output Formula
                  </button>
                </div>
                <div className="space-y-2">
                  {draft.outputs.map((out, idx) => (
                    <div key={idx} className="rounded-lg border border-slate-200 dark:border-slate-800 p-2.5 space-y-2">
                      <div className="grid grid-cols-12 gap-2 items-center">
                        <input
                          type="text"
                          value={out.key}
                          onChange={(e) =>
                            setDraft((p) => ({
                              ...p,
                              outputs: p.outputs.map((item, i) =>
                                i === idx ? { ...item, key: e.target.value.replace(/[^a-zA-Z0-9_]/g, '') } : item
                              ),
                            }))
                          }
                          placeholder="Key"
                          className="col-span-2 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1 text-xs font-mono"
                        />
                        <input
                          type="text"
                          value={out.labelEn}
                          onChange={(e) =>
                            setDraft((p) => ({
                              ...p,
                              outputs: p.outputs.map((item, i) => (i === idx ? { ...item, labelEn: e.target.value } : item)),
                            }))
                          }
                          placeholder="Label EN"
                          className="col-span-3 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1 text-xs"
                        />
                        <input
                          type="text"
                          value={out.expression}
                          onChange={(e) =>
                            setDraft((p) => ({
                              ...p,
                              outputs: p.outputs.map((item, i) =>
                                i === idx ? { ...item, expression: e.target.value } : item
                              ),
                            }))
                          }
                          placeholder="Expression e.g. SQRT3 * V * I * PF"
                          className="col-span-4 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1 text-xs font-mono"
                        />
                        <input
                          type="text"
                          value={out.unit || ''}
                          onChange={(e) =>
                            setDraft((p) => ({
                              ...p,
                              outputs: p.outputs.map((item, i) => (i === idx ? { ...item, unit: e.target.value } : item)),
                            }))
                          }
                          placeholder="Unit"
                          className="col-span-1 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-1.5 py-1 text-xs"
                        />
                        <input
                          type="number"
                          value={out.precision}
                          min={0}
                          max={8}
                          onChange={(e) =>
                            setDraft((p) => ({
                              ...p,
                              outputs: p.outputs.map((item, i) =>
                                i === idx ? { ...item, precision: Number(e.target.value) } : item
                              ),
                            }))
                          }
                          className="col-span-1 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-1.5 py-1 text-xs font-mono"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setDraft((p) => ({ ...p, outputs: p.outputs.filter((_, i) => i !== idx) }))
                          }
                          className="col-span-1 flex justify-center text-slate-400 hover:text-red-600 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="grid grid-cols-12 gap-2 items-center text-[11px]">
                        <input
                          type="text"
                          value={out.labelBn}
                          onChange={(e) =>
                            setDraft((p) => ({
                              ...p,
                              outputs: p.outputs.map((item, i) => (i === idx ? { ...item, labelBn: e.target.value } : item)),
                            }))
                          }
                          placeholder="Label BN (বাংলা)"
                          className="col-span-5 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1 text-[11px]"
                        />
                        <select
                          value={out.format || 'decimal'}
                          onChange={(e) =>
                            setDraft((p) => ({
                              ...p,
                              outputs: p.outputs.map((item, i) =>
                                i === idx
                                  ? { ...item, format: e.target.value as CalculatorOutputField['format'] }
                                  : item
                              ),
                            }))
                          }
                          className="col-span-4 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1 text-[11px]"
                        >
                          <option value="decimal">Format: Decimal</option>
                          <option value="scientific">Format: Scientific</option>
                          <option value="currency">Format: Currency</option>
                          <option value="percentage">Format: Percentage</option>
                        </select>
                        <label className="col-span-3 inline-flex items-center gap-1.5 text-[11px]">
                          <input
                            type="checkbox"
                            checked={Boolean(out.primary)}
                            onChange={(e) =>
                              setDraft((p) => ({
                                ...p,
                                outputs: p.outputs.map((item, i) =>
                                  i === idx ? { ...item, primary: e.target.checked } : item
                                ),
                              }))
                            }
                          />
                          <span>Primary Card</span>
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Conditions Builder */}
              <div className="space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold">Conditional Rules & Warnings</h4>
                  <button
                    type="button"
                    onClick={addCondition}
                    className="text-xs font-medium text-blue-700 dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    + Add Condition
                  </button>
                </div>
                {(draft.conditions || []).map((cond, idx) => (
                  <div key={cond.id} className="rounded-lg border border-slate-200 dark:border-slate-800 p-2 space-y-2">
                    <div className="grid grid-cols-12 gap-2 items-center">
                      <input
                        type="text"
                        value={cond.expression}
                        onChange={(e) =>
                          setDraft((p) => ({
                            ...p,
                            conditions: (p.conditions || []).map((c, i) =>
                              i === idx ? { ...c, expression: e.target.value } : c
                            ),
                          }))
                        }
                        placeholder="Condition e.g. PF < 0.85"
                        className="col-span-4 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1 text-xs font-mono"
                      />
                      <select
                        value={cond.severity}
                        onChange={(e) =>
                          setDraft((p) => ({
                            ...p,
                            conditions: (p.conditions || []).map((c, i) =>
                              i === idx ? { ...c, severity: e.target.value as CalculatorCondition['severity'] } : c
                            ),
                          }))
                        }
                        className="col-span-2 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1 text-xs"
                      >
                        <option value="info">Info</option>
                        <option value="warning">Warning</option>
                        <option value="error">Error</option>
                      </select>
                      <input
                        type="text"
                        value={cond.messageEn}
                        onChange={(e) =>
                          setDraft((p) => ({
                            ...p,
                            conditions: (p.conditions || []).map((c, i) =>
                              i === idx ? { ...c, messageEn: e.target.value } : c
                            ),
                          }))
                        }
                        placeholder="Alert message (EN)"
                        className="col-span-5 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setDraft((p) => ({
                            ...p,
                            conditions: (p.conditions || []).filter((_, i) => i !== idx),
                          }))
                        }
                        className="col-span-1 flex justify-center text-slate-400 hover:text-red-600 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <input
                      type="text"
                      value={cond.messageBn}
                      onChange={(e) =>
                        setDraft((p) => ({
                          ...p,
                          conditions: (p.conditions || []).map((c, i) =>
                            i === idx ? { ...c, messageBn: e.target.value } : c
                          ),
                        }))
                      }
                      placeholder="Alert message (বাংলা)"
                      className="w-full rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-2 py-1 text-[11px]"
                    />
                  </div>
                ))}
              </div>

              {/* Syntax Audit & Custom Live Sandbox Test */}
              <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 space-y-3">
                <p className="text-xs font-semibold flex items-center gap-1.5">
                  <Play className="w-3.5 h-3.5 text-blue-600" />
                  <span>Live Formula Sandbox Verification (Custom Test Inputs)</span>
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {draft.inputs.map((inp) => (
                    <label key={inp.key} className="block space-y-1 text-[11px]">
                      <span className="font-mono text-slate-500">{inp.key}</span>
                      <input
                        type="number"
                        step="any"
                        value={sandboxInputs[inp.key] ?? inp.defaultValue}
                        onChange={(e) =>
                          setSandboxInputs((prev) => ({
                            ...prev,
                            [inp.key]: Number(e.target.value),
                          }))
                        }
                        className="w-full rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs font-mono-tabular"
                      />
                    </label>
                  ))}
                </div>
                {syntaxAudit.length > 0 ? (
                  <div className="text-xs text-red-600 space-y-1">
                    {syntaxAudit.map((e, i) => (
                      <p key={i}>{e}</p>
                    ))}
                  </div>
                ) : !testRunResult.valid ? (
                  <div className="text-xs text-amber-600 space-y-1">
                    {testRunResult.validationErrors.map((e, i) => (
                      <p key={i}>{e}</p>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-3 text-xs font-mono-tabular">
                    {testRunResult.outputs.map((o) => (
                      <span key={o.key} className="text-blue-700 dark:text-blue-400 font-semibold">
                        {o.key} = {o.formatted} {o.unit || ''}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                <input
                  type="text"
                  value={changeNote}
                  onChange={(e) => setChangeNote(e.target.value)}
                  placeholder="Version change note"
                  className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs"
                />
                <label className="inline-flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={draft.enabled}
                    onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })}
                  />
                  <span>Calculator Enabled</span>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Version History & Rollback */}
        {versions.length > 0 && (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-3">
            <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
              <History className="w-3.5 h-3.5 text-blue-600" />
              <span>Formula Version History & Restore</span>
            </h4>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {versions.map((v) => (
                <div key={v.id} className="py-2 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold font-mono-tabular">v{v.version}</span> ·{' '}
                    <span className="text-slate-600 dark:text-slate-400">{v.changeNote || 'Snapshot'}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => restoreVersion(v)}
                    className="inline-flex items-center gap-1 text-blue-700 dark:text-blue-400 hover:underline cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Load v{v.version}</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
