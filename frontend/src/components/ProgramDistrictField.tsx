import { useId } from 'react';
import { useAppSettings } from '../lib/appSettings';

export type ProgramDistrictType = 'program' | 'district';

export default function ProgramDistrictField({
  label,
  type,
  value,
  programs,
  districts,
  districtLabel = 'District',
  districtPlaceholder = 'Select or enter a district',
  required = false,
  onTypeChange,
  onValueChange,
}: {
  label: string;
  type: ProgramDistrictType;
  value: string;
  programs: string[];
  districts: string[];
  districtLabel?: string;
  districtPlaceholder?: string;
  required?: boolean;
  onTypeChange: (type: ProgramDistrictType) => void;
  onValueChange: (value: string) => void;
}) {
  const { t } = useAppSettings();
  const listId = useId();
  const options = [...new Set(type === 'program' ? programs : districts)];

  return (
    <div className="field">
      <label htmlFor={`${listId}-input`}>{t(label)}</label>
      <div className="field-row">
        <select
          aria-label={t('Entity type')}
          value={type}
          onChange={event => onTypeChange(event.target.value as ProgramDistrictType)}
        >
          <option value="program">{t('Program')}</option>
          <option value="district">{t(districtLabel)}</option>
        </select>
        <input
          id={`${listId}-input`}
          list={listId}
          value={value}
          required={required}
          onChange={event => onValueChange(event.target.value)}
          placeholder={t(type === 'program' ? 'Select or enter a program' : districtPlaceholder)}
        />
      </div>
      <datalist id={listId}>
        {options.map(option => <option key={option} value={option} />)}
      </datalist>
    </div>
  );
}
