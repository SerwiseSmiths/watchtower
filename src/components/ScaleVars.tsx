'use client';
import { useEffect } from 'react';
import { hScaleFactor, vScaleFactor } from '@/lib/matrix.utils';

export function ScaleVars() {
    useEffect(() => {
        document.documentElement.style.setProperty('--hScale', String(hScaleFactor));
        document.documentElement.style.setProperty('--vScale', String(vScaleFactor));
    }, []);
    return null;
}
