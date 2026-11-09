package com.smartbin.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import com.smartbin.entity.Student;

import jakarta.persistence.LockModeType;

/**
 * Data access gateway for student profiles.
 */
@Repository
public interface StudentRepository extends JpaRepository<Student, String> {

    Optional<Student> findByMssv(String mssv);

    boolean existsByMssv(String mssv);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from Student s where s.mssv = :mssv")
    Optional<Student> findWithLockByMssv(@Param("mssv") String mssv);
}
