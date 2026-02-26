"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getStudents,
  getMassDates,
  getAvailabilities,
  getAssignments,
  getHymns,
  submitAvailability,
  saveAssignments,
  createMassDate,
  deleteMassDate,
} from "@/lib/firestore";
import type {
  Student,
  MassDate,
  StudentAvailability,
  Assignment,
  Hymn,
  RoleType,
  AvailabilityStatus,
} from "@/types";

export function useStudents() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStudents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getStudents();
      setStudents(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "학생 목록을 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  return { students, loading, error, refetch: fetchStudents };
}

export function useMassDates() {
  const [massDates, setMassDates] = useState<MassDate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMassDates = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getMassDates();
      setMassDates(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "미사 일정을 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMassDates();
  }, [fetchMassDates]);

  const addMassDate = async (date: Date, roles: RoleType[], createdBy: string) => {
    try {
      await createMassDate(date, roles, createdBy);
      await fetchMassDates();
    } catch (err) {
      throw err;
    }
  };

  const removeMassDate = async (id: string) => {
    try {
      await deleteMassDate(id);
      await fetchMassDates();
    } catch (err) {
      throw err;
    }
  };

  return {
    massDates,
    loading,
    error,
    refetch: fetchMassDates,
    addMassDate,
    removeMassDate,
  };
}

export function useAvailabilities(massDateId?: string) {
  const [availabilities, setAvailabilities] = useState<StudentAvailability[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAvailabilities = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getAvailabilities(massDateId);
      setAvailabilities(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "응답 데이터를 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }, [massDateId]);

  useEffect(() => {
    fetchAvailabilities();
  }, [fetchAvailabilities]);

  const submit = async (
    studentId: string,
    status: AvailabilityStatus,
    comment?: string
  ) => {
    if (!massDateId) throw new Error("미사 날짜가 선택되지 않았습니다.");
    try {
      await submitAvailability(studentId, massDateId, status, comment);
      await fetchAvailabilities();
    } catch (err) {
      throw err;
    }
  };

  return {
    availabilities,
    loading,
    error,
    refetch: fetchAvailabilities,
    submit,
  };
}

export function useAssignments(massDateId: string) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAssignments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getAssignments(massDateId);
      setAssignments(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "배정 데이터를 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }, [massDateId]);

  useEffect(() => {
    if (massDateId) {
      fetchAssignments();
    }
  }, [massDateId, fetchAssignments]);

  const save = async (
    newAssignments: {
      studentId: string;
      role: RoleType;
      isPrimary: boolean;
      backupOrder?: number;
    }[]
  ) => {
    try {
      await saveAssignments(massDateId, newAssignments);
      await fetchAssignments();
    } catch (err) {
      throw err;
    }
  };

  return {
    assignments,
    loading,
    error,
    refetch: fetchAssignments,
    save,
  };
}

export function useHymns() {
  const [hymns, setHymns] = useState<Hymn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHymns = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getHymns();
      setHymns(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "성가 목록을 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHymns();
  }, [fetchHymns]);

  return { hymns, loading, error, refetch: fetchHymns };
}
