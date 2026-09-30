import { useId } from 'react';
import { useAppSettings } from '../lib/appSettings';

export type ProgramDistrictType = 'program' | 'district';

export default function ProgramDistrictField({
  label,
  type,
  value,
  programs,
  districts,
  onTypeChange,
  onValueChange,
}: {
  label: string;
  type: ProgramDistrictType;
  value: string;
  programs: string[];
  districts: string[];
  onTypeChange: (type: ProgramDistrictType) => void;
  onValueChange: (value: string) => void;
}) {
  const { t } = useAppSettings();
  const listId = useId();
  const options = [...new Set(type === 'program' ? programs : districts)];

  return (
    <div className="field">
      <label>{t(label)}</label>
      <div className="field-row">
        <select
          aria-label={t('Entity type')}
          value={type}
          onChange={event => onTypeChange(event.target.value as ProgramDistrictType)}
        >
          <option value="program">{t('Program')}</option>
          <option value="district">{t('District')}</option>
        </select>
        <input
          list={listId}
          value={value}
          onChange={event => onValueChange(event.target.value)}
          placeholder={t(type === 'program' ? 'Select or enter a program' : 'Select or enter a district')}
        />
      </div>
      <datalist id={listId}>
        {options.map(option => <option key={option} value={option} />)}
      </datalist>
    </div>
  );
}
