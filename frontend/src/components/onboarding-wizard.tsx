import { ArrowLeft, ArrowRight, Check, GraduationCap, Sparkles, X } from 'lucide-react';
import { useState } from 'react';
import { useLocation } from 'wouter';
import { saveOnboardingProfile } from '@/services/profileService';
import type { OnboardingProfileData, StudentRole } from '@/types/domain';

const steps = ['Education', 'Interests', 'Preferences', 'Skills', 'Complete'];
const interestOptions = ['Cybersecurity', 'Artificial Intelligence', 'Machine Learning', 'Web Development', 'Cloud Computing', 'Data Science', 'Open Source', 'Product Development', 'Software Engineering', 'Other'];
const opportunityOptions = ['Hackathons', 'Internships', 'Scholarships', 'Fellowships', 'Competitions'];
const skillSuggestions = ['Python', 'C++', 'JavaScript', 'React', 'Cybersecurity', 'Computer Networks', 'Git', 'GitHub', 'Cloud', 'Machine Learning'];

const initialData: OnboardingProfileData = {
  role: 'Student',
  degree: '',
  branch: '',
  studyYear: 1,
  skills: [],
  interests: [],
  preferredOpportunityTypes: [],
};

type Props = {
  preview?: boolean;
  onClose: () => void;
};

function toggleValue(values: string[], value: string) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

export function OnboardingWizard({ preview = false, onClose }: Props) {
  const [, navigate] = useLocation();
  const [step, setStep] = useState(0);
  const [data, setData] = useState<OnboardingProfileData>(initialData);
  const [skillInput, setSkillInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [completed, setCompleted] = useState(false);

  const canContinue = step === 0
    ? Boolean(data.role && data.degree && data.branch && data.studyYear)
    : step === 2
      ? data.preferredOpportunityTypes.length > 0
      : true;

  const addSkill = (value: string) => {
    const clean = value.trim();
    if (clean && !data.skills.includes(clean)) setData((current) => ({ ...current, skills: [...current.skills, clean] }));
    setSkillInput('');
  };

  const finish = async () => {
    setError('');
    if (preview) {
      setCompleted(true);
      return;
    }
    setSaving(true);
    try {
      await saveOnboardingProfile(data);
      setCompleted(true);
    } catch {
      setError('We couldn’t save your profile right now. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const closeAfterComplete = () => {
    onClose();
    navigate('/dashboard');
  };

  return (
    <div className="onboarding-backdrop" role="presentation">
      <section className="onboarding-dialog" role="dialog" aria-modal="true" aria-labelledby="onboarding-title" data-testid="modal-onboarding">
        <header className="onboarding-header">
          <div>
            <div className="eyebrow"><Sparkles size={13} /> Opportunity setup</div>
            <h2 id="onboarding-title">Let&apos;s personalize your opportunities</h2>
            <p>Tell us a little about yourself so OpportunityOS can find opportunities that fit you.</p>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close onboarding" data-testid="button-close-onboarding"><X size={18} /></button>
        </header>

        <div className="onboarding-progress" aria-label={`Step ${step + 1} of ${steps.length}`}>
          {steps.map((label, index) => <div className={`onboarding-progress-step${index <= step ? ' active' : ''}`} key={label}><span>{index < step ? <Check size={11} /> : index + 1}</span><small>{label}</small></div>)}
        </div>

        <div className="onboarding-body">
          {completed ? (
            <div className="onboarding-complete" data-testid="onboarding-complete">
              <div className="empty-icon"><Check size={24} /></div>
              <h3 className="display">Your opportunity context is ready.</h3>
              <p className="muted">{preview ? 'This is a preview only. Connect the profile service to save these choices.' : 'Your profile was saved. We can now use it to personalize the opportunity workspace.'}</p>
              <button className="btn btn-primary" onClick={closeAfterComplete} data-testid="button-find-opportunities"><span>Find My Opportunities</span> <ArrowRight size={15} /></button>
            </div>
          ) : (
            <>
              {step === 0 && (
                <div className="onboarding-step">
                  <div className="onboarding-step-heading"><GraduationCap size={22} /><div><h3>Start with your education</h3><p>These details help us understand where an opportunity fits.</p></div></div>
                  <div className="onboarding-form-grid">
                    <div><label className="label" htmlFor="onboarding-role">Current role</label><select id="onboarding-role" className="field" value={data.role} onChange={(event) => setData({ ...data, role: event.target.value as StudentRole })}><option>Student</option><option>Recent Graduate</option></select></div>
                    <div><label className="label" htmlFor="onboarding-degree">Degree</label><select id="onboarding-degree" className="field" value={data.degree} onChange={(event) => setData({ ...data, degree: event.target.value })}><option value="">Select degree</option>{['B.Tech', 'B.E.', 'B.Sc', 'BCA', 'M.Tech', 'MCA', 'Other'].map((option) => <option key={option}>{option}</option>)}</select></div>
                    <div className="onboarding-form-wide"><label className="label" htmlFor="onboarding-branch">Branch / Field</label><select id="onboarding-branch" className="field" value={data.branch} onChange={(event) => setData({ ...data, branch: event.target.value })}><option value="">Select field</option>{['Computer Science and Engineering', 'Information Technology', 'Electronics and Communication', 'Electrical Engineering', 'Mechanical Engineering', 'Other'].map((option) => <option key={option}>{option}</option>)}</select></div>
                    <div className="onboarding-form-wide"><label className="label" htmlFor="onboarding-study-year">Current study year</label><select id="onboarding-study-year" className="field" value={data.studyYear} onChange={(event) => setData({ ...data, studyYear: Number(event.target.value) })}>{[1, 2, 3, 4, 5].map((year) => <option value={year} key={year}>{year === 5 ? '5+' : year}</option>)}</select></div>
                  </div>
                </div>
              )}
              {step === 1 && (
                <div className="onboarding-step">
                  <div className="onboarding-step-heading"><Sparkles size={22} /><div><h3>What are you curious about?</h3><p>Select everything that feels relevant. You can change this later.</p></div></div>
                  <div className="onboarding-chip-grid">{interestOptions.map((interest) => <button type="button" className={`onboarding-chip${data.interests.includes(interest) ? ' selected' : ''}`} onClick={() => setData({ ...data, interests: toggleValue(data.interests, interest) })} key={interest} aria-pressed={data.interests.includes(interest)}>{data.interests.includes(interest) && <Check size={14} />}{interest}</button>)}</div>
                </div>
              )}
              {step === 2 && (
                <div className="onboarding-step">
                  <div className="onboarding-step-heading"><Sparkles size={22} /><div><h3>What opportunities are you looking for?</h3><p>Choose the types you want to see in your workspace.</p></div></div>
                  <div className="onboarding-chip-grid">{opportunityOptions.map((option) => <button type="button" className={`onboarding-chip${data.preferredOpportunityTypes.includes(option) ? ' selected' : ''}`} onClick={() => setData({ ...data, preferredOpportunityTypes: toggleValue(data.preferredOpportunityTypes, option) })} key={option} aria-pressed={data.preferredOpportunityTypes.includes(option)}>{data.preferredOpportunityTypes.includes(option) && <Check size={14} />}{option}</button>)}</div>
                </div>
              )}
              {step === 3 && (
                <div className="onboarding-step">
                  <div className="onboarding-step-heading"><Sparkles size={22} /><div><h3>Add the skills you want to use</h3><p>Only add skills you actually have. This step is optional.</p></div></div>
                  <div className="onboarding-skill-suggestions">{skillSuggestions.map((skill) => <button type="button" className={`onboarding-chip${data.skills.includes(skill) ? ' selected' : ''}`} onClick={() => setData({ ...data, skills: toggleValue(data.skills, skill) })} key={skill} aria-pressed={data.skills.includes(skill)}>{data.skills.includes(skill) && <Check size={14} />}{skill}</button>)}</div>
                  <div style={{ marginTop: '1rem' }}><label className="label" htmlFor="onboarding-custom-skill">Add another skill</label><div style={{ display: 'flex', gap: '.5rem' }}><input id="onboarding-custom-skill" className="field" value={skillInput} onChange={(event) => setSkillInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addSkill(skillInput); } }} placeholder="Type a skill" /><button type="button" className="btn btn-outline" onClick={() => addSkill(skillInput)}>Add</button></div></div>
                  {data.skills.length > 0 && <div className="onboarding-selected-list" aria-label="Selected skills">{data.skills.map((skill) => <span className="pill pill-teal" key={skill}>{skill}<button type="button" onClick={() => setData({ ...data, skills: data.skills.filter((item) => item !== skill) })} aria-label={`Remove ${skill}`}><X size={12} /></button></span>)}</div>}
                </div>
              )}
              {step === 4 && (
                <div className="onboarding-step onboarding-summary">
                  <div className="onboarding-step-heading"><Check size={22} /><div><h3>One last look</h3><p>Review the context you want OpportunityOS to use.</p></div></div>
                  <div className="onboarding-summary-grid"><div><span className="mono eyebrow">ROLE</span><strong>{data.role}</strong></div><div><span className="mono eyebrow">EDUCATION</span><strong>{data.degree} · {data.branch}</strong><small>Year {data.studyYear === 5 ? '5+' : data.studyYear}</small></div><div><span className="mono eyebrow">INTERESTS</span><strong>{data.interests.length ? data.interests.join(', ') : 'None selected'}</strong></div><div><span className="mono eyebrow">OPPORTUNITIES</span><strong>{data.preferredOpportunityTypes.join(', ')}</strong></div><div><span className="mono eyebrow">SKILLS</span><strong>{data.skills.length ? data.skills.join(', ') : 'None added'}</strong></div></div>
                  {error && <div className="readonly-box onboarding-error" role="alert">{error}</div>}
                </div>
              )}
            </>
          )}
        </div>

        {!completed && (
          <footer className="onboarding-actions">
            <button className="btn btn-ghost" onClick={() => setStep((current) => Math.max(0, current - 1))} disabled={step === 0 || saving}><ArrowLeft size={14} /> Back</button>
            {step < steps.length - 1 ? <button className="btn btn-primary" onClick={() => setStep((current) => Math.min(steps.length - 1, current + 1))} disabled={!canContinue}>Continue <ArrowRight size={14} /></button> : <button className="btn btn-primary" onClick={finish} disabled={saving}>{saving ? 'Saving…' : 'Find My Opportunities'} <ArrowRight size={15} /></button>}
          </footer>
        )}
      </section>
    </div>
  );
}