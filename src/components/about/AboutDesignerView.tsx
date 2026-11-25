import React, { useState } from 'react';
import {
  Award,
  Check,
  Compass,
  Copy,
  Info,
  Mail,
  MessageSquarePlus,
  Phone,
  Target,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const AboutDesignerView: React.FC = () => {
  const { language, designerInfo, navigateTo, showToast } = useApp();
  const [copiedPhone, setCopiedPhone] = useState(false);

  const telClean = designerInfo.mobile
    .replace(/[০-৯]/g, (d) => String('০১২৩৪৫৬৭৮৯'.indexOf(d)))
    .replace(/[^0-9+]/g, '');

  const handleCopyPhone = async () => {
    try {
      await navigator.clipboard.writeText(telClean || designerInfo.mobile);
      setCopiedPhone(true);
      showToast(language === 'bn' ? 'মোবাইল নম্বর কপি হয়েছে' : 'Mobile number copied', 'success');
      window.setTimeout(() => setCopiedPhone(false), 1500);
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
          <Info className="w-6 h-6 text-blue-700 dark:text-blue-400 shrink-0" />
          <span>{language === 'bn' ? 'ডিজাইনার ও অ্যাপ পরিচিতি' : 'Designer Information & Platform Vision'}</span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-0.5">
          {language === 'bn'
            ? 'SUTRO SATHI (সূত্রসাথী) — সকল হিসাব, সকল সূত্র, এক প্ল্যাটফর্মে।'
            : 'SUTRO SATHI — Every calculation, every formula, on one platform.'}
        </p>
      </div>

      {/* Designer Profile Card */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5 pb-6 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl bg-blue-700 text-white flex items-center justify-center text-2xl font-bold shrink-0">
              MH
            </div>
            <div className="space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-400">
                {language === 'bn' ? 'প্ল্যাটফর্ম ডিজাইনার ও পরিকল্পনাকারী' : 'Platform Designer & Creator'}
              </p>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                {language === 'bn' ? designerInfo.nameBn : designerInfo.nameEn}
              </h2>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                <Award className="w-4 h-4 text-blue-600 shrink-0" />
                <span>{language === 'bn' ? designerInfo.designationBn : designerInfo.designationEn}</span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a
              href={`tel:${telClean}`}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-xs font-semibold text-white hover:bg-blue-800"
            >
              <Phone className="w-3.5 h-3.5" />
              <span className="font-mono-tabular">{language === 'bn' ? designerInfo.mobile : telClean}</span>
            </a>

            <button
              type="button"
              onClick={() => void handleCopyPhone()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3.5 py-2.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              {copiedPhone ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{language === 'bn' ? 'নম্বর কপি' : 'Copy'}</span>
            </button>

            {designerInfo.email && (
              <a
                href={`mailto:${designerInfo.email}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3.5 py-2.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <Mail className="w-3.5 h-3.5 text-blue-600" />
                <span>{language === 'bn' ? 'ইমেইল' : 'Email'}</span>
              </a>
            )}
          </div>
        </div>

        {/* About Designer */}
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            {language === 'bn' ? 'ডিজাইনার সম্পর্কে' : 'About the Designer'}
          </h3>
          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
            {language === 'bn' ? designerInfo.aboutBn : designerInfo.aboutEn}
          </p>
        </div>

        {/* Project Vision & App Mission */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-blue-700 dark:text-blue-400 flex items-center gap-1.5">
              <Compass className="w-4 h-4" />
              <span>{language === 'bn' ? 'প্রজেক্ট ভিশন' : 'Project Vision'}</span>
            </h4>
            <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              {language === 'bn' ? designerInfo.visionBn : designerInfo.visionEn}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4 space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
              <Target className="w-4 h-4" />
              <span>{language === 'bn' ? 'অ্যাপ মিশন' : 'Application Mission'}</span>
            </h4>
            <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              {language === 'bn' ? designerInfo.missionBn : designerInfo.missionEn}
            </p>
          </div>
        </div>

        <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800">
          <p className="text-xs text-slate-500">
            {language === 'bn'
              ? 'নতুন ফিচার বা উন্নতির কোনো পরামর্শ দিতে চাইলে সরাসরি মতামত পাঠান।'
              : 'Have a feature idea or feedback? Send a suggestion directly to the platform team.'}
          </p>
          <button
            type="button"
            onClick={() => navigateTo('suggestions')}
            className="inline-flex items-center gap-2 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 px-4 py-2 text-xs font-semibold text-blue-700 dark:text-blue-300 hover:bg-blue-100 cursor-pointer"
          >
            <MessageSquarePlus className="w-3.5 h-3.5" />
            <span>{language === 'bn' ? 'পরামর্শ ও মতামত পাঠান' : 'Submit Suggestion'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
