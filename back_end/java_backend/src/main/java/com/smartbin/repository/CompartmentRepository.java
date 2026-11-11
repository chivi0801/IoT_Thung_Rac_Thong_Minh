package com.smartbin.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.smartbin.entity.Compartment;

/**
 * Data access gateway for the physical waste compartments.
 */
@Repository
public interface CompartmentRepository extends JpaRepository<Compartment, Integer> {

    Optional<Compartment> findByKey(String key);

    List<Compartment> findAllByOrderByIdAsc();
}
